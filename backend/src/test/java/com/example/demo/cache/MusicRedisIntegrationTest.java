package com.example.demo.cache;

import com.example.demo.lastfm.LastfmProperties;
import com.example.demo.lastfm.LastfmService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@Tag("redis")
class MusicRedisIntegrationTest {
    private LettuceConnectionFactory connection;
    private StringRedisTemplate redis;
    private final String artist = "integration-" + UUID.randomUUID();

    @BeforeEach void connect() {
        var config = new RedisStandaloneConfiguration("127.0.0.1", Integer.parseInt(System.getProperty("redis.test.port", "6379")));
        config.setDatabase(15);
        connection = new LettuceConnectionFactory(config, LettuceClientConfiguration.builder().commandTimeout(Duration.ofSeconds(2)).build());
        connection.afterPropertiesSet();
        redis = new StringRedisTemplate(connection);
        try (var socket = connection.getConnection()) { assertThat(socket.ping()).isEqualTo("PONG"); }
    }

    @AfterEach void cleanup() {
        if (connection == null) return;
        try {
            if (redis != null) redis.delete(List.of(
                    MusicMetadataCache.key("track-tags", List.of(artist, "Song")),
                    MusicMetadataCache.key("artist-tags", List.of(artist)),
                    MusicMetadataCache.key("listeners", List.of(artist, "Song")),
                    MusicMetadataCache.key("similar-artists", List.of(artist, "10")),
                    MusicMetadataCache.key("similar-artists", List.of(artist, "1"))));
        } finally { connection.destroy(); }
    }

    private MusicMetadataCache cache(MusicCacheProperties props) { return new MusicMetadataCache(redis, new ObjectMapper(), props); }

    @Test void twoServiceInstancesReuseTagsListenersAndSimilarCandidatesThroughRealRedis() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(queryParam("method", "track.gettoptags")).andRespond(withSuccess(
                "{\"toptags\":{\"tag\":[{\"name\":\"pop\",\"count\":100},{\"name\":\"rock\",\"count\":80},{\"name\":\"indie\",\"count\":50}]}}", MediaType.APPLICATION_JSON));
        server.expect(queryParam("method", "track.getInfo")).andRespond(withSuccess("{\"track\":{\"listeners\":123}}", MediaType.APPLICATION_JSON));
        server.expect(queryParam("method", "artist.getsimilar")).andExpect(queryParam("limit", "10")).andRespond(withSuccess(
                "{\"similarartists\":{\"artist\":[{\"name\":\"Other Artist\",\"match\":0.8}]}}", MediaType.APPLICATION_JSON));
        server.expect(queryParam("method", "artist.getsimilar")).andExpect(queryParam("limit", "1")).andRespond(withSuccess(
                "{\"similarartists\":{\"artist\":[]}}", MediaType.APPLICATION_JSON));
        var props = new LastfmProperties(); props.setApiKey("test"); props.setBaseUrl("https://lastfm.test");
        var first = new LastfmService(props, builder, cache(new MusicCacheProperties()));
        var second = new LastfmService(props, builder, cache(new MusicCacheProperties()));
        var tags = first.getTrackTags(artist, "Song");
        long listeners = first.getTrackListeners(artist, "Song");
        var similar = first.getSimilarArtists(artist, 10);
        // 100 repeat readers on another service instance must make zero additional HTTP calls.
        for (int i = 0; i < 100; i++) {
            assertThat(second.getTrackTags(artist, "Song")).isEqualTo(tags);
            assertThat(second.getTrackListeners(artist, "Song")).isEqualTo(listeners);
            assertThat(second.getSimilarArtists(artist, 10)).isEqualTo(similar);
        }
        assertThat(second.getSimilarArtists(artist, 1)).isEmpty();
        assertThat(redis.getExpire(MusicMetadataCache.key("track-tags", List.of(artist, "Song"))))
                .isBetween(Duration.ofDays(7).toSeconds() - 60, Duration.ofDays(7).toSeconds());
        assertThat(redis.getExpire(MusicMetadataCache.key("similar-artists", List.of(artist, "1"))))
                .isBetween(540L, 600L);
        server.verify();
    }

    @Test void expiredMetadataIsReloadedAfterActualRedisExpiry() throws Exception {
        var props = new MusicCacheProperties(); props.setMetadataTtl(Duration.ofMillis(100));
        var cache = cache(props);
        var type = new TypeReference<Long>() {};
        var parts = List.of(artist, "Song");
        AtomicInteger loads = new AtomicInteger();
        assertThat(cache.get("listeners", parts, type, () -> (long) loads.incrementAndGet())).isEqualTo(1);
        String key = MusicMetadataCache.key("listeners", parts);
        long deadline = System.nanoTime() + Duration.ofSeconds(3).toNanos();
        while (Boolean.TRUE.equals(redis.hasKey(key)) && System.nanoTime() < deadline) Thread.sleep(20);
        assertThat(redis.hasKey(key)).isFalse();
        assertThat(cache.get("listeners", parts, type, () -> (long) loads.incrementAndGet())).isEqualTo(2);
    }
}
