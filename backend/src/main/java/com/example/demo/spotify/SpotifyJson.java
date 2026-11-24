package com.example.demo.spotify;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Objects;

/**
 * Spotify Web API 응답 중 우리가 읽는 필드만. 모르는 필드는 무시한다.
 * 필드가 빠지면 null이며, 필수 값 확인은 SpotifyService가 한다.
 */
final class SpotifyJson {
    private SpotifyJson() {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TopTracks(List<Track> items) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TrackSearch(TrackPage tracks) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TrackPage(List<Track> items) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ArtistSearch(ArtistPage artists) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ArtistPage(List<Artist> items) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Track(String uri, String name, List<Artist> artists, Album album) {
        List<Artist> credited() {
            return artists == null ? List.of() : artists.stream().filter(Objects::nonNull).toList();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Artist(String id, String name, List<Image> images) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Album(List<Image> images) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Image(String url) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Playlist(String id, @JsonProperty("external_urls") ExternalUrls externalUrls) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ExternalUrls(String spotify) {}

    /** 첫 이미지의 주소. 없으면 빈 문자열(화면에서 기본 이미지를 쓴다). */
    static String firstImage(List<Image> images) {
        if (images == null || images.isEmpty() || images.getFirst() == null || images.getFirst().url() == null) return "";
        return images.getFirst().url();
    }
}
