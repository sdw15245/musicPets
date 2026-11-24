package com.example.demo.analysis;

import com.example.demo.recommendation.RecommendationService.RecommendedTrack;
import com.example.demo.recommendation.RecommendationService.RecommendedArtist;
import com.example.demo.spotify.SpotifyLimitException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * 한 번의 분석에서 파생된 결과. 원본 트랙은 서버 메모리(RecentTracks)에만 보관한다.
 * 예전에 저장된 형식을 읽는 규칙은 StoredAnalysisJson에 있다.
 *
 * @param recommendations    아티스트 추천 이전에 저장된 추천곡. 새 결과에서는 항상 비어 있다.
 * @param recommendedArtists 아티스트 추천 이전 결과는 null. 프론트는 null이면 예전 추천곡 화면을 보여준다.
 */
public record AnalysisResult(String id, Instant analyzedAt, Genres genres, MatchedCharacter character,
                             Profile profile, List<RecommendedTrack> recommendations,
                             boolean recommendationsAvailable, List<String> warnings,
                             SpotifyLimitException.Limit recommendationLimit,
                             boolean profilePending, boolean recommendationsPending,
                             List<RecommendedArtist> recommendedArtists) {
    private static final String ARTISTS_UNAVAILABLE = "추천 아티스트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";

    public record Genres(Map<String, Double> vector, List<String> unmappedTags, int tagCount, int trackCount, String timeRange) {}
    public record MatchedCharacter(String slug, String name, String description, String imageUrl, double score) {}
    public record Profile(Double mainstream, Double obscurity, String comment) {}

    /** 펫 매칭까지만 끝나고 AI 해설과 추천 아티스트는 아직 기다리는 결과. */
    static AnalysisResult pending(String id, Instant analyzedAt, Genres genres, MatchedCharacter character, List<String> warnings) {
        return new AnalysisResult(id, analyzedAt, genres, character, new Profile(null, null, ""), List.of(), false,
                warnings, null, true, true, List.of());
    }

    AnalysisResult withProfile(Profile value, List<String> notices) {
        return new AnalysisResult(id, analyzedAt, genres, character, value, recommendations, recommendationsAvailable,
                Stream.concat(warnings.stream(), notices.stream()).distinct().toList(), recommendationLimit, false, recommendationsPending, recommendedArtists);
    }

    public AnalysisResult withArtistRecommendations(List<RecommendedArtist> artists) {
        return withArtistRecommendations(artists, true, null);
    }

    /** 사용량 제한(limit)은 별도 화면으로 안내하므로 일반 실패일 때만 경고 문구를 붙인다. */
    AnalysisResult withArtistRecommendations(List<RecommendedArtist> artists, boolean available, SpotifyLimitException.Limit limit) {
        var remaining = warnings.stream().filter(warning -> !warning.equals(ARTISTS_UNAVAILABLE));
        if (!available && limit == null) remaining = Stream.concat(remaining, Stream.of(ARTISTS_UNAVAILABLE));
        return new AnalysisResult(id, analyzedAt, genres, character, profile, recommendations, available,
                remaining.toList(), limit, profilePending, false, List.copyOf(artists));
    }
}
