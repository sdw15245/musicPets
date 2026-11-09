package com.example.demo.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import java.time.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** A controlled Redis boundary for cache policy tests; actual wire format also has an integration test. */
public class RedisCacheFixture {
    public final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked")
    public final ValueOperations<String, String> values = mock(ValueOperations.class);
    public final MusicCacheProperties props = new MusicCacheProperties();
    public final ConcurrentHashMap<String, String> data = new ConcurrentHashMap<>();
    public final ConcurrentHashMap<String, Instant> expiry = new ConcurrentHashMap<>();
    public final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-11-07T00:00:00Z"));
    private final Clock clock = mock(Clock.class);

    public RedisCacheFixture() {
        when(clock.instant()).thenAnswer(call -> now.get());
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(anyString())).thenAnswer(call -> {
            String key = call.getArgument(0);
            return expiry.getOrDefault(key, Instant.MAX).isAfter(now.get()) ? data.get(key) : null;
        });
        doAnswer(call -> {
            String key = call.getArgument(0);
            data.put(key, call.getArgument(1));
            expiry.put(key, now.get().plus(call.<Duration>getArgument(2)));
            return null;
        }).when(values).set(anyString(), anyString(), any(Duration.class));
    }

    public MusicMetadataCache cache() { return new MusicMetadataCache(redis, new ObjectMapper(), props, clock); }
}
