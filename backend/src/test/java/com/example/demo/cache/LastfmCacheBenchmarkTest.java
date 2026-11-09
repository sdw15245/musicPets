package com.example.demo.cache;

import com.example.demo.config.ExternalApiConfig;
import com.example.demo.lastfm.LastfmProperties;
import com.example.demo.lastfm.LastfmService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.web.client.RestClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/** Manual measurement only. Never part of ordinary test/redisTest or CI. */
@Tag("live-cache")
class LastfmCacheBenchmarkTest {
    record Track(String artist, String title) {}
    record Lookup(String category, Function<LastfmService, Object> call) {}
    record Sample(String artist, String title, String category, int round, String phase,
                  double elapsedMs, int providerCalls, int resultSize, long ttlSeconds) {}

    @Test void compareColdLookupsWithRepeatedRedisReads() throws Exception {
        String key = apiKey();
        assertThat(key).as("LASTFM_API_KEY must be configured").isNotBlank();
        String prefix = "musicpets:benchmark:" + UUID.randomUUID() + ":";
        var config = new RedisStandaloneConfiguration("127.0.0.1", Integer.parseInt(System.getProperty("redis.test.port", "6379")));
        config.setDatabase(15);
        var connection = new LettuceConnectionFactory(config,
                LettuceClientConfiguration.builder().commandTimeout(Duration.ofMillis(300)).build());
        connection.afterPropertiesSet();
        var redis = new StringRedisTemplate(connection);
        // Namespace every key without changing the real application's cache implementation.
        redis.setKeySerializer(new StringRedisSerializer() {
            @Override public byte[] serialize(String value) { return super.serialize(prefix + value); }
        });
        var tracks = List.of(new Track("Radiohead", "Creep"), new Track("Daft Punk", "Get Lucky"), new Track("검정치마", "Everything"));
        List<String> ownedKeys = tracks.stream().flatMap(track -> keys(track).stream()).toList();
        List<Sample> samples = new ArrayList<>();
        AtomicInteger requests = new AtomicInteger();
        var props = new LastfmProperties();
        props.setApiKey(key);
        props.setBaseUrl("https://ws.audioscrobbler.com/2.0/");
        var builder = RestClient.builder();
        new ExternalApiConfig().externalApiTimeouts().customize(builder);
        builder.requestInterceptor((request, body, execution) -> {
            requests.incrementAndGet();
            return execution.execute(request, body);
        });
        var mapper = new ObjectMapper();
        var first = new LastfmService(props, builder, new MusicMetadataCache(redis, mapper, new MusicCacheProperties()));
        var second = new LastfmService(props, builder, new MusicMetadataCache(redis, mapper, new MusicCacheProperties()));
        Path report = Path.of("build/reports/cache-benchmark/results.json");
        boolean completed = false;
        try {
            try (var socket = connection.getConnection()) { assertThat(socket.ping()).isEqualTo("PONG"); }
            for (int round = 1; round <= 3; round++) {
                for (Track track : tracks) {
                    redis.delete(keys(track));
                    var lookups = List.of(
                            new Lookup("track-tags", service -> service.getTrackTags(track.artist(), track.title())),
                            new Lookup("listeners", service -> service.getTrackListeners(track.artist(), track.title())),
                            new Lookup("similar-artists", service -> service.getSimilarArtists(track.artist(), 10)));
                    for (Lookup lookup : lookups) {
                        Thread.sleep(350); // Pace real provider traffic; excluded from measurement.
                        String cacheKey = cacheKey(track, lookup.category());
                        assertThat(redis.hasKey(cacheKey)).isFalse();
                        int before = requests.get();
                        long start = System.nanoTime();
                        Object cold = lookup.call().apply(first);
                        double duration = (System.nanoTime() - start) / 1_000_000.0;
                        int calls = requests.get() - before;
                        assertThat(calls).isPositive();
                        assertThat(redis.hasKey(cacheKey)).isTrue();
                        samples.add(new Sample(track.artist(), track.title(), lookup.category(), round, "miss", duration,
                                calls, size(cold), redis.getExpire(cacheKey)));
                        for (int repeat = 0; repeat < 10; repeat++) {
                            before = requests.get();
                            start = System.nanoTime();
                            Object warm = lookup.call().apply(second);
                            duration = (System.nanoTime() - start) / 1_000_000.0;
                            calls = requests.get() - before;
                            assertThat(warm).isEqualTo(cold);
                            assertThat(calls).as("cache hit must not call Last.fm").isZero();
                            samples.add(new Sample(track.artist(), track.title(), lookup.category(), round, "hit", duration,
                                    calls, size(warm), redis.getExpire(cacheKey)));
                        }
                    }
                }
            }
            completed = true;
        } catch (Exception failure) {
            // HTTP exceptions may contain the request URL/API key. Do not copy them into reports.
            throw new IllegalStateException("Cache measurement failed: " + failure.getClass().getSimpleName() + "; partial samples saved, credentials omitted.");
        } finally {
            try {
                Files.createDirectories(report.getParent());
                mapper.writerWithDefaultPrettyPrinter().writeValue(report.toFile(), Map.of(
                        "completed", completed, "measuredAt", Instant.now().toString(), "redisDb", 15,
                        "rounds", 3, "warmReadsPerMiss", 10, "providerRequests", requests.get(), "samples", samples));
            } finally {
                try { redis.delete(ownedKeys); } finally { connection.destroy(); }
            }
        }
    }

    private static int size(Object value) {
        return value instanceof Collection<?> collection ? collection.size() : ((Number) value).longValue() > 0 ? 1 : 0;
    }

    private static String cacheKey(Track track, String category) {
        return MusicMetadataCache.key(category, category.equals("artist-tags") ? List.of(track.artist())
                : category.equals("similar-artists") ? List.of(track.artist(), "10") : List.of(track.artist(), track.title()));
    }

    private static List<String> keys(Track track) {
        return List.of("track-tags", "artist-tags", "listeners", "similar-artists").stream().map(category -> cacheKey(track, category)).toList();
    }

    private static String apiKey() throws Exception {
        String value = System.getenv("LASTFM_API_KEY");
        if (value != null && !value.isBlank()) return value;
        for (String line : Files.readAllLines(Path.of(".env"))) {
            String trimmed = line.strip();
            if (!trimmed.startsWith("LASTFM_API_KEY=")) continue;
            value = trimmed.substring("LASTFM_API_KEY=".length()).strip();
            if (value.length() >= 2 && (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'")))
                value = value.substring(1, value.length() - 1);
            return value;
        }
        return "";
    }
}
