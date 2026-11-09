package com.example.demo.spotify;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Spotify Web API 호출.
 * 토큰 자체는 SpotifyTokenService가 관리. 여기서는 API 호출만.
 */
@Service
public class SpotifyService {

    private static final String API_BASE = "https://api.spotify.com/v1";
    public static final String TOP_TRACK_TIME_RANGE = "short_term";

    private final SpotifyTokenService tokenService;
    private final RestClient restClient;
    private final SpotifyRequestGuard requestGuard;

    @org.springframework.beans.factory.annotation.Autowired
    public SpotifyService(SpotifyTokenService tokenService, RestClient.Builder builder) {
        this(tokenService, builder, new SpotifyRequestGuard());
    }

    SpotifyService(SpotifyTokenService tokenService, RestClient.Builder builder, SpotifyRequestGuard requestGuard) {
        this.tokenService = tokenService;
        this.requestGuard = requestGuard;
        this.restClient = builder.clone()
                .requestInterceptor((request, body, execution) -> {
                    requestGuard.check();
                    return execution.execute(request, body);
                })
                .defaultStatusHandler(status -> status.value() == 429,
                        (request, response) -> requestGuard.reject(response))
                .build();
    }

    /** 최근 약 4주의 Spotify 선호도 기준 top tracks. 실제 재생 횟수 순위는 아니다. */
    public List<TopTrack> getTopTracks(Long userId, int limit) {
        return getTopTracks(userId, limit, TOP_TRACK_TIME_RANGE);
    }

    public List<TopTrack> getTopTracks(Long userId, int limit, String timeRange) {
        if (!List.of("short_term", "medium_term", "long_term").contains(timeRange)) {
            throw new IllegalArgumentException("Unsupported Spotify time range");
        }
        requestGuard.check();
        String accessToken = tokenService.getValidAccessToken(userId);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = restClient.get()
                .uri(API_BASE + "/me/top/tracks?limit=" + limit + "&time_range=" + timeRange)
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(Map.class);

        if (response == null) {
            throw new RestClientException("Spotify top tracks: empty response");
        }

        if (!(response.get("items") instanceof List<?>)) {
            throw new RestClientException("Spotify top tracks: invalid items");
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("items");
        if (items.isEmpty()) {
            return List.of();
        }

        // 2026-02 Web API 변경으로 track.popularity 필드가 제거됨 → Spotify는 곡명/아티스트만.
        // 대중성(마이너함)은 Last.fm listeners로 따로 계산한다(LastfmService).
        return items.stream()
                .map(item -> {
                    String trackName = (String) item.get("name");
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> artists = (List<Map<String, Object>>) item.get("artists");
                    String artistName = (artists == null || artists.isEmpty())
                            ? "" : (String) artists.get(0).get("name");
                    List<ArtistRef> credited = artists == null ? List.of() : artists.stream()
                            .filter(a -> a.get("name") instanceof String)
                            .map(a -> new ArtistRef((String) a.get("name"), (String) a.get("id"))).toList();
                    return new TopTrack(trackName, artistName, credited);
                })
                .toList();
    }

    @SuppressWarnings("unchecked")
    public List<TrackHit> searchTracks(Long userId, String query, int limit) {
        requestGuard.check();
        String accessToken = tokenService.getValidAccessToken(userId);
        String q = URLEncoder.encode(query, StandardCharsets.UTF_8);

        Map<String, Object> response = restClient.get()
                .uri(java.net.URI.create(API_BASE + "/search?type=track&limit=" + limit + "&q=" + q))
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(Map.class);

        if (response == null || !(response.get("tracks") instanceof Map<?, ?> tracks)) {
            throw new RestClientException("Spotify search: invalid response");
        }
        if (!(tracks.get("items") instanceof List<?> items)) throw new RestClientException("Spotify search: missing items");
        return items.stream().filter(item -> item instanceof Map<?, ?>)
                .map(item -> toTrackHit((Map<?, ?>) item)).filter(java.util.Objects::nonNull).toList();
    }

    public TrackHit getTrack(Long userId, String id) {
        requestGuard.check();
        Map<?, ?> response = restClient.get().uri(API_BASE + "/tracks/" + id)
                .header("Authorization", "Bearer " + tokenService.getValidAccessToken(userId))
                .retrieve().body(Map.class);
        TrackHit track = response == null ? null : toTrackHit(response);
        if (track == null) throw new RestClientException("Spotify track: invalid response");
        return track;
    }

    private TrackHit toTrackHit(Map<?, ?> t) {
        if (!(t.get("uri") instanceof String uri) || !(t.get("name") instanceof String name)) return null;

        String artist = t.get("artists") instanceof List<?> artists ? artists.stream()
                .filter(item -> item instanceof Map<?, ?>)
                .map(item -> ((Map<?, ?>) item).get("name")).filter(item -> item instanceof String)
                .map(Object::toString).collect(java.util.stream.Collectors.joining(", ")) : "";

        String imageUrl = "";
        if (t.get("album") instanceof Map<?, ?> album
                && album.get("images") instanceof List<?> images && !images.isEmpty()
                && images.get(0) instanceof Map<?, ?> img) {
            Object url = img.get("url");
            imageUrl = url == null ? "" : url.toString();
        }

        return uri == null ? null : new TrackHit(uri, name, artist, imageUrl);
    }

    /** 새 플레이리스트 생성. 생성된 id + 웹 URL 반환. (playlist-modify 권한 필요) */
    @SuppressWarnings("unchecked")
    public PlaylistRef createPlaylist(Long userId, String name, String description) {
        requestGuard.check();
        String accessToken = tokenService.getValidAccessToken(userId);

        Map<String, Object> response = restClient.post()
                .uri(API_BASE + "/me/playlists")
                .header("Authorization", "Bearer " + accessToken)
                .body(Map.of("name", name, "description", description, "public", true))
                .retrieve()
                .body(Map.class);

        if (response == null) {
            throw new RestClientException("Spotify create playlist: empty response");
        }
        String id = (String) response.get("id");
        String url = "";
        if (response.get("external_urls") instanceof Map<?, ?> ext) {
            Object spotify = ((Map<String, Object>) ext).get("spotify");
            url = spotify == null ? "" : spotify.toString();
        }
        return new PlaylistRef(id, url);
    }

    /** 플레이리스트에 트랙 URI들 추가. */
    public void addTracksToPlaylist(Long userId, String playlistId, List<String> uris) {
        if (uris == null || uris.isEmpty()) return;
        requestGuard.check();
        String accessToken = tokenService.getValidAccessToken(userId);

        restClient.post()
                .uri(API_BASE + "/playlists/" + playlistId + "/items")
                .header("Authorization", "Bearer " + accessToken)
                .body(Map.of("uris", uris))
                .retrieve()
                .toBodilessEntity();
    }

    public record ArtistRef(String name, String id) {}
    public record TopTrack(String name, String artist, List<ArtistRef> artists) {
        public TopTrack(String name, String artist) { this(name, artist, List.of(new ArtistRef(artist, null))); }
    }
    public record ArtistHit(String id, String name, String uri, String imageUrl) {}

    /** Only accept an unambiguous name match; the first search hit alone is not identity proof. */
    public ArtistHit searchArtist(Long userId, String name) {
        requestGuard.check();
        String query = URLEncoder.encode(name, StandardCharsets.UTF_8);
        Map<?, ?> response = restClient.get()
                .uri(java.net.URI.create(API_BASE + "/search?type=artist&limit=10&q=" + query))
                .header("Authorization", "Bearer " + tokenService.getValidAccessToken(userId))
                .retrieve().body(Map.class);
        if (response == null || !(response.get("artists") instanceof Map<?, ?> artists)
                || !(artists.get("items") instanceof List<?> items))
            throw new RestClientException("Spotify artist search: invalid response");
        List<ArtistHit> hits = new java.util.ArrayList<>();
        for (Object item : items) {
            if (!(item instanceof Map<?, ?> a) || !(a.get("id") instanceof String id)
                    || !id.matches("[A-Za-z0-9]+") || !(a.get("name") instanceof String label)) continue;
            String image = "";
            if (a.get("images") instanceof List<?> images && !images.isEmpty()
                    && images.getFirst() instanceof Map<?, ?> first && first.get("url") instanceof String url) image = url;
            hits.add(new ArtistHit(id, label, "spotify:artist:" + id, image));
        }
        var exact = hits.stream().filter(h -> artistNameKey(h.name()).equals(artistNameKey(name))).toList();
        if (!exact.isEmpty()) return exact.size() == 1 ? exact.getFirst() : null;
        // Last.fm sometimes joins Korean and Latin names in one label. Match whole words only.
        String normalized = " " + artistNameKey(name) + " ";
        var bilingual = hits.stream().filter(h -> name.codePoints().anyMatch(c -> c >= 0xAC00 && c <= 0xD7A3)
                && name.matches(".*[A-Za-z].*") && normalized.contains(" " + artistNameKey(h.name()) + " ")).toList();
        return bilingual.size() == 1 ? bilingual.getFirst() : null;
    }

    public static String artistNameKey(String name) {
        return java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFKC)
                .toLowerCase(java.util.Locale.ROOT).trim().replaceAll("\\s+", " ");
    }

    public record TrackHit(String uri, String name, String artist, String imageUrl) {}

    public record PlaylistRef(String id, String url) {}
}
