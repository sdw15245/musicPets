package com.example.demo.analysis;

import com.example.demo.recommendation.RecommendationService.RecommendedTrack;
import com.example.demo.recommendation.RecommendationService.RecommendedArtist;
import com.example.demo.spotify.SpotifyLimitException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/** 한 번의 분석에서 파생된 결과. 원본 트랙은 서버 캐시에만 보관한다. */
public record AnalysisResult(String id, Instant analyzedAt, Genres genres, MatchedCharacter character,
                             Profile profile, List<RecommendedTrack> recommendations,
                             boolean recommendationsAvailable, List<String> warnings,
                             SpotifyLimitException.Limit recommendationLimit,
                             boolean profilePending, boolean recommendationsPending,
                             List<RecommendedArtist> recommendedArtists) {
    // Null identifies a stored result made before artist recommendations were introduced.
    public AnalysisResult(String id, Instant analyzedAt, Genres genres, MatchedCharacter character,
                          Profile profile, List<RecommendedTrack> recommendations, boolean recommendationsAvailable,
                          List<String> warnings, SpotifyLimitException.Limit recommendationLimit,
                          boolean profilePending, boolean recommendationsPending) {
        this(id, analyzedAt, genres, character, profile, recommendations, recommendationsAvailable, warnings,
                recommendationLimit, profilePending, recommendationsPending, null);
    }
    public AnalysisResult(String id, Instant analyzedAt, Genres genres, MatchedCharacter character,
                          Profile profile, List<RecommendedTrack> recommendations, boolean recommendationsAvailable,
                          List<String> warnings, SpotifyLimitException.Limit recommendationLimit) {
        this(id, analyzedAt, genres, character, profile, recommendations, recommendationsAvailable, warnings,
                recommendationLimit, false, false);
    }
    public record Genres(Map<String, Double> vector, List<String> unmappedTags, int tagCount, int trackCount, String timeRange) {
        public Genres {
            // Stored results from before the four-week rollout used medium_term.
            if (timeRange == null) timeRange = "medium_term";
        }
        public Genres(Map<String, Double> vector, List<String> unmappedTags, int tagCount, int trackCount) {
            this(vector, unmappedTags, tagCount, trackCount, "medium_term");
        }
    }
    public record MatchedCharacter(String slug, String name, String description, String imageUrl, double score) {}
    public record Profile(Double mainstream, Double obscurity, String comment) {}

    AnalysisResult withProfile(Profile value, List<String> notices) {
        return new AnalysisResult(id, analyzedAt, genres, character, value, recommendations, recommendationsAvailable,
                Stream.concat(warnings.stream(), notices.stream()).distinct().toList(), recommendationLimit, false, recommendationsPending, recommendedArtists);
    }

    public AnalysisResult withArtistRecommendations(List<RecommendedArtist> artists) {
        return withArtistRecommendations(artists, true, null);
    }

    AnalysisResult withArtistRecommendations(List<RecommendedArtist> artists, boolean available, SpotifyLimitException.Limit limit) {
        var remaining = warnings.stream().filter(w -> !w.equals(AnalysisService.RECOMMENDATIONS_WARNING)
                && !w.equals("추천곡을 불러오지 못했어요. 추천곡만 다시 시도할 수 있어요."));
        if (!available && limit == null) remaining = Stream.concat(remaining, Stream.of(AnalysisService.RECOMMENDATIONS_WARNING));
        return new AnalysisResult(id, analyzedAt, genres, character, profile, recommendations, available,
                remaining.toList(), limit, profilePending, false, List.copyOf(artists));
    }
}
