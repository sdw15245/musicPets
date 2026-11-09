package com.example.demo.recommendation;

import com.example.demo.lastfm.LastfmService;

import com.example.demo.spotify.SpotifyService;
import com.example.demo.spotify.SpotifyService.PlaylistRef;
import com.example.demo.spotify.SpotifyService.TopTrack;

import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 아티스트 추천과 이전 분석에 저장된 곡의 플레이리스트 저장. */
@Service
public class RecommendationService {
    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);

    private final SpotifyService spotify;
    private final LastfmService lastfm;

    public RecommendationService(SpotifyService spotify, LastfmService lastfm) {
        this.spotify = spotify;
        this.lastfm = lastfm;
    }

    public record RecommendedTrack(String name, String artist, String uri, String imageUrl) {}
    public record RecommendedArtist(String name, String uri, String imageUrl, List<String> basedOn) {}
    private record ArtistSeed(String name, int count) {}
    private static final class ArtistCandidate {
        final String name;
        final Map<String, Double> evidence = new LinkedHashMap<>();
        ArtistCandidate(String name) { this.name = name; }
        double score() { return evidence.values().stream().mapToDouble(Double::doubleValue).sum(); }
    }

    public List<RecommendedArtist> recommendArtists(Long userId, List<TopTrack> tracks) {
        Map<String, ArtistSeed> counts = new LinkedHashMap<>();
        Set<String> knownNames = new HashSet<>();
        Set<String> knownIds = new HashSet<>();
        for (TopTrack track : tracks) {
            Set<String> counted = new HashSet<>();
            for (var artist : track.artists()) {
                if (artist.name() == null || artist.name().isBlank()) continue;
                String nameKey = SpotifyService.artistNameKey(artist.name());
                knownNames.add(nameKey);
                if (artist.id() != null && !artist.id().isBlank()) knownIds.add(artist.id());
                String identity = artist.id() == null || artist.id().isBlank() ? nameKey : artist.id();
                if (counted.add(identity)) counts.compute(identity, (k, old) ->
                        new ArtistSeed(old == null ? artist.name().trim() : old.name(), old == null ? 1 : old.count() + 1));
            }
        }
        var seeds = counts.values().stream().sorted(java.util.Comparator.comparingInt(ArtistSeed::count).reversed()).limit(5).toList();
        Map<String, ArtistCandidate> candidates = new LinkedHashMap<>();
        int similarCount = 0;
        for (ArtistSeed seed : seeds) {
            checkInterrupted();
            for (var similar : lastfm.getSimilarArtists(seed.name(), 10)) {
                similarCount++;
                String nameKey = SpotifyService.artistNameKey(similar.name());
                if (knownNames.contains(nameKey) || !Double.isFinite(similar.match()) || similar.match() <= 0) continue;
                candidates.computeIfAbsent(nameKey, k -> new ArtistCandidate(similar.name().trim()))
                        .evidence.merge(seed.name(), similar.match(), Math::max);
            }
        }
        Map<String, ArtistCandidate> resolved = new LinkedHashMap<>();
        Map<String, SpotifyService.ArtistHit> hits = new LinkedHashMap<>();
        var ranked = candidates.values().stream().sorted(java.util.Comparator.comparingDouble(ArtistCandidate::score).reversed()).limit(15).toList();
        for (ArtistCandidate candidate : ranked) {
            checkInterrupted();
            var hit = spotify.searchArtist(userId, candidate.name);
            if (hit == null || hit.id() == null || hit.uri() == null || knownIds.contains(hit.id())
                    || knownNames.contains(SpotifyService.artistNameKey(hit.name()))) continue;
            hits.putIfAbsent(hit.id(), hit);
            var combined = resolved.computeIfAbsent(hit.id(), k -> new ArtistCandidate(hit.name()));
            candidate.evidence.forEach((seed, score) -> combined.evidence.merge(seed, score, Math::max));
        }
        var result = resolved.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue().score(), a.getValue().score())).limit(3)
                .map(entry -> {
                    var hit = hits.get(entry.getKey());
                    var evidence = entry.getValue().evidence.entrySet().stream()
                            .sorted(Map.Entry.<String, Double>comparingByValue().reversed()).map(Map.Entry::getKey).toList();
                    return new RecommendedArtist(hit.name(), hit.uri(), hit.imageUrl(), evidence);
                }).toList();
        String outcome = !result.isEmpty() ? "ready" : seeds.isEmpty() ? "no_seeds"
                : similarCount == 0 ? "no_similar_artists" : candidates.isEmpty() ? "only_known_artists" : "no_spotify_match";
        log.info("artist_recommendation_summary seeds={} similar_artists={} candidates={} results={} outcome={}",
                seeds.size(), similarCount, candidates.size(), result.size(), outcome);
        return result;
    }

    private static void checkInterrupted() {
        if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Recommendations cancelled");
    }

    /** 이전 분석에 저장된 추천곡으로 Spotify 플레이리스트를 만든다. */
    public String saveAsPlaylist(Long userId, String name, List<String> uris) {
        if (uris == null || uris.isEmpty() || uris.size() > 100
                || uris.stream().anyMatch(uri -> uri == null || !uri.matches("spotify:track:[A-Za-z0-9]+"))) {
            throw new InvalidPlaylistException();
        }
        PlaylistRef pl = spotify.createPlaylist(userId, name, "음악 캐릭터 매칭이 추천한 곡들");
        spotify.addTracksToPlaylist(userId, pl.id(), uris);
        return pl.url();
    }

}
