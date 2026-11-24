package com.example.demo.spotify;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Spotify Web API 호출.
 * 토큰 자체는 SpotifyTokenService가 관리. 여기서는 API 호출만.
 * 필수 값이 빠진 응답은 빈 결과로 바꾸지 않고 RestClientException으로 알린다(외부 서비스 실패, 502).
 */
@Service
public class SpotifyService {

    private static final String API_BASE = "https://api.spotify.com/v1";
    public static final String TOP_TRACK_TIME_RANGE = "short_term";

    private final SpotifyTokenService tokenService;
    private final RestClient restClient;
    private final SpotifyRequestGuard requestGuard;

    @Autowired
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
        var response = call(userId, HttpMethod.GET, "/me/top/tracks?limit=" + limit + "&time_range=" + timeRange, null)
                .body(SpotifyJson.TopTracks.class);
        // 빈 목록은 "청취 기록 없음"이라는 의미가 있으므로, 목록이 없는 응답과 구분한다.
        if (response == null || response.items() == null) {
            throw new RestClientException("Spotify top tracks: invalid items");
        }

        // 2026-02 Web API 변경으로 track.popularity 필드가 제거됨 → Spotify는 곡명/아티스트만.
        // 대중성(마이너함)은 Last.fm listeners로 따로 계산한다(LastfmService).
        return response.items().stream().filter(Objects::nonNull).map(item -> {
            var artists = item.credited();
            String artistName = artists.isEmpty() || artists.getFirst().name() == null ? "" : artists.getFirst().name();
            List<ArtistRef> credited = artists.stream().filter(a -> a.name() != null)
                    .map(a -> new ArtistRef(a.name(), a.id())).toList();
            return new TopTrack(item.name(), artistName, credited);
        }).toList();
    }

    public List<TrackHit> searchTracks(Long userId, String query, int limit) {
        var response = call(userId, HttpMethod.GET,
                "/search?type=track&limit=" + limit + "&q=" + URLEncoder.encode(query, StandardCharsets.UTF_8), null)
                .body(SpotifyJson.TrackSearch.class);
        if (response == null || response.tracks() == null) throw new RestClientException("Spotify search: invalid response");
        if (response.tracks().items() == null) throw new RestClientException("Spotify search: missing items");
        return response.tracks().items().stream().map(SpotifyService::toTrackHit).filter(Objects::nonNull).toList();
    }

    public TrackHit getTrack(Long userId, String id) {
        TrackHit track = toTrackHit(call(userId, HttpMethod.GET, "/tracks/" + id, null).body(SpotifyJson.Track.class));
        if (track == null) throw new RestClientException("Spotify track: invalid response");
        return track;
    }

    /** 이름이나 URI가 없는 곡은 보여줄 수 없으므로 null. */
    private static TrackHit toTrackHit(SpotifyJson.Track track) {
        if (track == null || track.uri() == null || track.name() == null) return null;
        String artist = track.credited().stream().map(SpotifyJson.Artist::name).filter(Objects::nonNull)
                .collect(Collectors.joining(", "));
        String imageUrl = track.album() == null ? "" : SpotifyJson.firstImage(track.album().images());
        return new TrackHit(track.uri(), track.name(), artist, imageUrl);
    }

    /** 새 플레이리스트 생성. 생성된 id + 웹 URL 반환. (playlist-modify 권한 필요) */
    public PlaylistRef createPlaylist(Long userId, String name, String description) {
        var response = call(userId, HttpMethod.POST, "/me/playlists",
                Map.of("name", name, "description", description, "public", true))
                .body(SpotifyJson.Playlist.class);
        if (response == null || response.id() == null) {
            throw new RestClientException("Spotify create playlist: invalid response");
        }
        String url = response.externalUrls() == null || response.externalUrls().spotify() == null
                ? "" : response.externalUrls().spotify();
        return new PlaylistRef(response.id(), url);
    }

    /** 플레이리스트에 트랙 URI들 추가. */
    public void addTracksToPlaylist(Long userId, String playlistId, List<String> uris) {
        if (uris == null || uris.isEmpty()) return;
        call(userId, HttpMethod.POST, "/playlists/" + playlistId + "/items", Map.of("uris", uris)).toBodilessEntity();
    }

    public record ArtistRef(String name, String id) {}
    public record TopTrack(String name, String artist, List<ArtistRef> artists) {
        public TopTrack(String name, String artist) { this(name, artist, List.of(new ArtistRef(artist, null))); }
    }
    public record ArtistHit(String id, String name, String uri, String imageUrl) {}

    /** 이름이 확실히 일치하는 아티스트 하나. 모호하거나 없으면 null(ArtistNames 참고). */
    public ArtistHit searchArtist(Long userId, String name) {
        var response = call(userId, HttpMethod.GET,
                "/search?type=artist&limit=10&q=" + URLEncoder.encode(name, StandardCharsets.UTF_8), null)
                .body(SpotifyJson.ArtistSearch.class);
        if (response == null || response.artists() == null || response.artists().items() == null)
            throw new RestClientException("Spotify artist search: invalid response");
        List<ArtistHit> hits = response.artists().items().stream()
                .filter(a -> a != null && a.id() != null && a.id().matches("[A-Za-z0-9]+") && a.name() != null)
                .map(a -> new ArtistHit(a.id(), a.name(), "spotify:artist:" + a.id(), SpotifyJson.firstImage(a.images())))
                .toList();
        return ArtistNames.pick(name, hits);
    }

    public record TrackHit(String uri, String name, String artist, String imageUrl) {}

    public record PlaylistRef(String id, String url) {}

    /**
     * 사용자 토큰을 붙여 요청한다. 경로와 쿼리는 이미 인코딩된 값이어야 한다.
     * 사용량 제한 중이면 토큰 갱신 요청도 보내지 않도록 먼저 확인한다(인터셉터는 실제 전송 직전에 한 번 더 확인).
     */
    private RestClient.ResponseSpec call(Long userId, HttpMethod method, String pathAndQuery, Object body) {
        requestGuard.check();
        var request = restClient.method(method).uri(URI.create(API_BASE + pathAndQuery))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenService.getValidAccessToken(userId));
        if (body != null) request.body(body);
        return request.retrieve();
    }
}
