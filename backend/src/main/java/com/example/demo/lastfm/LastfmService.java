package com.example.demo.lastfm;

import com.example.demo.cache.MusicMetadataCache;
import com.fasterxml.jackson.core.type.TypeReference;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Last.fm 태그 조회.
 * 곡 태그가 부족(<3)하면 아티스트 태그로 자동 fallback.
 * 응답의 count(0~100)를 같이 가져와 가중치로 활용.
 */
@Service
public class LastfmService {

    private static final int MIN_TRACK_TAGS = 3;

    private final LastfmProperties props;
    private final RestClient restClient;
    private final MusicMetadataCache cache;
    private static final TypeReference<List<LastfmTag>> TAGS = new TypeReference<>() {};
    private static final TypeReference<Long> LISTENERS = new TypeReference<>() {};
    private static final TypeReference<List<SimilarArtist>> SIMILAR_ARTISTS = new TypeReference<>() {};

    public LastfmService(LastfmProperties props, RestClient.Builder builder, MusicMetadataCache cache) {
        this.props = props;
        this.cache = cache;
        this.restClient = builder.baseUrl(props.getBaseUrl()).build();
    }

    /**
     * 곡의 태그 (이름 + count). 3개 미만이면 아티스트 태그로 fallback.
     */
    public List<LastfmTag> getTrackTags(String artist, String track) {
        List<LastfmTag> trackTags = cache.get("track-tags", List.of(artist, track), TAGS, () -> fetchTags(q -> q
                .queryParam("method", "track.gettoptags")
                .queryParam("artist", artist)
                .queryParam("track", track)));

        if (trackTags.size() >= MIN_TRACK_TAGS) {
            return trackTags;
        }

        List<LastfmTag> artistTags = cache.get("artist-tags", List.of(artist), TAGS, () -> fetchTags(q -> q
                .queryParam("method", "artist.gettoptags")
                .queryParam("artist", artist)));
        // 보충할 아티스트 정보가 없더라도 이미 확인한 곡 태그는 보존한다.
        return artistTags.isEmpty() ? trackTags : artistTags;
    }

    /**
     * Last.fm에 집계된 곡의 청취자 수(listeners). 서비스 내 대중성 추정용.
     * 곡을 못 찾으면 0. (Spotify popularity 제거 대체 신호)
     */
    public long getTrackListeners(String artist, String track) {
        return cache.get("listeners", List.of(artist, track), LISTENERS, () -> fetchTrackListeners(artist, track));
    }

    private long fetchTrackListeners(String artist, String track) {
        Map<?, ?> response = request(q -> q
                .queryParam("method", "track.getInfo")
                .queryParam("artist", artist)
                .queryParam("track", track));

        if (!(response.get("track") instanceof Map<?, ?> trackInfo)) return 0;

        Object listeners = trackInfo.get("listeners");
        if (listeners == null) return 0;
        try {
            return Long.parseLong(listeners.toString().trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    public record SimilarArtist(String name, double match) {}

    public List<SimilarArtist> getSimilarArtists(String artist, int limit) {
        return cache.get("similar-artists", List.of(artist, Integer.toString(limit)), SIMILAR_ARTISTS, () -> {
            Map<?, ?> response = request(q -> q.queryParam("method", "artist.getsimilar")
                    .queryParam("artist", artist).queryParam("autocorrect", 1).queryParam("limit", limit));
            if ("6".equals(String.valueOf(response.get("error")))) return List.of();
            if (!(response.get("similarartists") instanceof Map<?, ?> root)
                    || !(root.get("artist") instanceof List<?> artists))
                throw new RestClientException("Last.fm similar artists: invalid response");
            List<SimilarArtist> results = new ArrayList<>();
            for (Object item : artists) {
                if (!(item instanceof Map<?, ?> entry) || !(entry.get("name") instanceof String name) || name.isBlank()) continue;
                try {
                    double score = Double.parseDouble(String.valueOf(entry.get("match")));
                    if (Double.isFinite(score) && score > 0 && score <= 1) results.add(new SimilarArtist(name.trim(), score));
                } catch (NumberFormatException ignored) { }
            }
            return List.copyOf(results);
        });
    }

    private Map<?, ?> request(Consumer<UriBuilder> queryCustomizer) {
        Map<?, ?> response = restClient.get()
                .uri(uriBuilder -> {
                    queryCustomizer.accept(uriBuilder);
                    uriBuilder.queryParam("api_key", props.getApiKey())
                              .queryParam("format", "json");
                    return uriBuilder.build();
                })
                .retrieve()
                .body(Map.class);

        checkResponse(response);
        return response;
    }

    private List<LastfmTag> fetchTags(Consumer<UriBuilder> queryCustomizer) {
        Map<?, ?> response = request(queryCustomizer);
        if (!(response.get("toptags") instanceof Map<?, ?> topTags)) return Collections.emptyList();

        if (!(topTags.get("tag") instanceof List<?> tags)) return Collections.emptyList();

        return tags.stream()
                .map(tag -> {
                    Map<?, ?> tagData = (Map<?, ?>) tag;
                    String name = (String) tagData.get("name");
                    Object countRaw = tagData.get("count");
                    int count = parseCount(countRaw);
                    return name == null || name.isBlank() ? null : new LastfmTag(name, count);
                })
                .filter(t -> t != null)
                .toList();
    }

    private static int parseCount(Object value) {
        if (value == null) return 0;
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static void checkResponse(Map<?, ?> response) {
        if (response == null) throw new RestClientException("Empty Last.fm response");
        Object error = response.get("error");
        // code 6: 곡/아티스트 없음. 태그 fallback 또는 빈 결과로 처리한다.
        if (error != null && !"6".equals(error.toString())) {
            throw new RestClientException("Last.fm request failed");
        }
    }
}
