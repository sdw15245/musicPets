package com.example.demo.cache;

import com.example.demo.lastfm.LastfmTag;
import com.fasterxml.jackson.core.type.TypeReference;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MusicMetadataCacheTest {
    private final RedisCacheFixture store = new RedisCacheFixture();
    private final MusicMetadataCache cache = store.cache();
    private static final TypeReference<List<LastfmTag>> TAGS = new TypeReference<>() {};
    private static final TypeReference<Long> COUNT = new TypeReference<>() {};
    private final List<String> track = List.of("Artist", "Song");

    @Test void anotherServerReusesTypedDataAndRefreshesAfterTtl() {
        AtomicInteger calls = new AtomicInteger();
        var first = cache.get("track-tags", track, TAGS, () -> {
            calls.incrementAndGet(); return List.of(new LastfmTag("pop", 100));
        });
        assertThat(store.cache().get("track-tags", List.of(" artist ", "SONG"), TAGS,
                () -> { throw new AssertionError("must reuse shared data"); })).isEqualTo(first);
        store.now.updateAndGet(now -> now.plus(Duration.ofDays(7)));
        var fresh = cache.get("track-tags", track, TAGS, () -> {
            calls.incrementAndGet(); return List.of(new LastfmTag("rock", 80));
        });
        assertThat(fresh).containsExactly(new LastfmTag("rock", 80));
        assertThat(calls).hasValue(2);
    }

    @Test void metadataAndEmptyResponsesHaveDifferentExpiryAndFailuresAreNeverStored() {
        cache.get("listeners", track, COUNT, () -> 123L);
        String countKey = MusicMetadataCache.key("listeners", track);
        assertThat(store.expiry.get(countKey)).isEqualTo(store.now.get().plus(Duration.ofDays(1)));
        cache.get("track-tags", track, TAGS, List::of);
        String tagsKey = MusicMetadataCache.key("track-tags", track);
        assertThat(store.expiry.get(tagsKey)).isEqualTo(store.now.get().plus(Duration.ofMinutes(10)));
        store.now.updateAndGet(now -> now.plus(Duration.ofMinutes(10)));
        assertThatThrownBy(() -> cache.get("track-tags", track, TAGS, () -> { throw new IllegalStateException("provider unavailable"); }))
                .isInstanceOf(IllegalStateException.class);
        assertThat(cache.get("track-tags", track, TAGS, () -> List.of(new LastfmTag("indie", 90))))
                .containsExactly(new LastfmTag("indie", 90));
    }

    @Test void redisReadFailureBypassesRepeatedTimeoutsThenRecovers() {
        String key = MusicMetadataCache.key("listeners", track);
        when(store.values.get(key)).thenThrow(new RedisConnectionFailureException("unavailable"));
        assertThat(cache.get("listeners", track, COUNT, () -> 10L)).isEqualTo(10L);
        assertThat(cache.get("listeners", track, COUNT, () -> 20L)).isEqualTo(20L);
        verify(store.values, times(1)).get(key);
        verify(store.values, never()).set(anyString(), anyString(), any(Duration.class));
        store.now.updateAndGet(now -> now.plusSeconds(30));
        doReturn("30").when(store.values).get(key);
        assertThat(cache.get("listeners", track, COUNT, () -> { throw new AssertionError("cache recovered"); })).isEqualTo(30L);
    }

    @Test void failedRedisWriteDoesNotDiscardSuccessfulProviderData() {
        doThrow(new RedisConnectionFailureException("unavailable"))
                .when(store.values).set(anyString(), anyString(), any(Duration.class));
        assertThat(cache.get("listeners", track, COUNT, () -> 123L)).isEqualTo(123L);
    }

    @Test void corruptedJsonIsReplacedAndDisabledCacheDoesNoRedisIo() {
        String key = MusicMetadataCache.key("track-tags", track);
        store.data.put(key, "not-json");
        assertThat(cache.get("track-tags", track, TAGS, () -> List.of(new LastfmTag("pop", 80))))
                .containsExactly(new LastfmTag("pop", 80));
        assertThat(store.data.get(key)).contains("pop");
        clearInvocations(store.redis, store.values);
        store.props.setEnabled(false);
        assertThat(cache.get("track-tags", track, TAGS, List::of)).isEmpty();
        verifyNoInteractions(store.redis, store.values);
    }

    @Test void keysSeparateArtistsMethodsAndLimitsWithoutKeepingRawNames() {
        String first = MusicMetadataCache.key("similar", List.of("Artist", "Song", "5"));
        assertThat(first).doesNotContain("Artist", "Song");
        assertThat(first).isNotEqualTo(MusicMetadataCache.key("similar", List.of("Other", "Song", "5")))
                .isNotEqualTo(MusicMetadataCache.key("similar", List.of("Artist", "Song", "1")))
                .isNotEqualTo(MusicMetadataCache.key("track-tags", List.of("Artist", "Song", "5")));
        assertThat(MusicMetadataCache.key("track-tags", List.of("a:b", "c")))
                .isNotEqualTo(MusicMetadataCache.key("track-tags", List.of("a", "b:c")));
    }

    @Test void overlappingRequestsShareOneProviderCall() throws Exception {
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> cache.get("listeners", track, COUNT, () -> {
                calls.incrementAndGet(); started.countDown();
                try { if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("timed out"); }
                catch (InterruptedException error) { throw new RuntimeException(error); }
                return 123L;
            }));
            try {
                assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
                var second = executor.submit(() -> cache.get("listeners", track, COUNT, () -> { calls.incrementAndGet(); return 456L; }));
                release.countDown();
                assertThat(first.get(5, TimeUnit.SECONDS)).isEqualTo(123L);
                assertThat(second.get(5, TimeUnit.SECONDS)).isEqualTo(123L);
                assertThat(calls).hasValue(1);
            } finally { release.countDown(); }
        }
    }
}
