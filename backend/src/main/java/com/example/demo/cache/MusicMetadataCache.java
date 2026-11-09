package com.example.demo.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/** Shared public music metadata only. No accounts, tokens or personal analysis results. */
@Component
public class MusicMetadataCache {
    private static final Logger log = LoggerFactory.getLogger(MusicMetadataCache.class);
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final MusicCacheProperties props;
    private final Clock clock;
    private final AtomicReference<Instant> retryAt = new AtomicReference<>(Instant.MIN);
    private final ConcurrentHashMap<String, CompletableFuture<Object>> inFlight = new ConcurrentHashMap<>();

    @Autowired
    public MusicMetadataCache(StringRedisTemplate redis, ObjectMapper mapper, MusicCacheProperties props) {
        this(redis, mapper, props, Clock.systemUTC());
    }

    MusicMetadataCache(StringRedisTemplate redis, ObjectMapper mapper, MusicCacheProperties props, Clock clock) {
        this.redis = redis;
        this.mapper = mapper;
        this.props = props;
        this.clock = clock;
    }

    public <T> T get(String category, List<String> parts, TypeReference<T> type, Supplier<T> loader) {
        if (!props.isEnabled()) return loader.get();
        String key = key(category, parts);
        CompletableFuture<Object> pending = new CompletableFuture<>();
        var existing = inFlight.putIfAbsent(key, pending);
        if (existing != null) return await(existing);
        try {
            T value = read(key, type);
            if (value == null) {
                // Provider exceptions propagate and are never cached.
                value = loader.get();
                if (value != null) write(key, value, ttl(category, value));
            }
            pending.complete(value);
            return value;
        } catch (RuntimeException | Error error) {
            pending.completeExceptionally(error);
            throw error;
        } finally {
            inFlight.remove(key, pending);
        }
    }

    private <T> T read(String key, TypeReference<T> type) {
        if (clock.instant().isBefore(retryAt.get())) return null;
        try {
            String json = redis.opsForValue().get(key);
            return json == null ? null : mapper.readValue(json, type);
        } catch (DataAccessException error) {
            pauseRedis();
        } catch (JsonProcessingException error) {
            // Old/corrupt entries are replaced by a successful load with a fresh TTL.
            log.warn("music_cache unreadable_entry");
        }
        return null;
    }

    private void write(String key, Object value, Duration ttl) {
        if (clock.instant().isBefore(retryAt.get())) return;
        try {
            redis.opsForValue().set(key, mapper.writeValueAsString(value), ttl);
        } catch (DataAccessException error) {
            pauseRedis();
        } catch (JsonProcessingException error) {
            log.warn("music_cache serialization_failed");
        }
    }

    private void pauseRedis() {
        Instant now = clock.instant();
        Instant previous = retryAt.getAndUpdate(current -> current.isAfter(now) ? current : now.plus(props.getRetryDelay()));
        if (!previous.isAfter(now)) log.warn("music_cache redis_unavailable bypass_seconds={}", props.getRetryDelay().toSeconds());
    }

    private Duration ttl(String category, Object value) {
        if (value instanceof Collection<?> items && items.isEmpty()
                || value instanceof Number number && number.longValue() <= 0) return props.getEmptyTtl();
        return category.endsWith("tags") ? props.getTagsTtl() : props.getMetadataTtl();
    }

    static String key(String category, List<String> parts) {
        StringBuilder identity = new StringBuilder();
        for (String part : parts) {
            String normalized = part.trim().toLowerCase(Locale.ROOT);
            identity.append(normalized.length()).append(':').append(normalized);
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(identity.toString().getBytes(StandardCharsets.UTF_8));
            return "musicpets:lastfm:v1:" + category + ":" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> T await(CompletableFuture<Object> task) {
        try {
            return (T) task.get();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Music metadata lookup interrupted", error);
        } catch (ExecutionException error) {
            if (error.getCause() instanceof RuntimeException cause) throw cause;
            if (error.getCause() instanceof Error cause) throw cause;
            throw new IllegalStateException("Music metadata lookup failed", error.getCause());
        }
    }
}
