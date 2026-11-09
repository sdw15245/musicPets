package com.example.demo.recommendation;

import com.example.demo.lastfm.LastfmService;
import com.example.demo.lastfm.LastfmService.SimilarArtist;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.spotify.SpotifyService.TopTrack;
import com.example.demo.spotify.SpotifyService.ArtistRef;
import com.example.demo.spotify.SpotifyService.ArtistHit;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.ArrayList;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ArtistRecommendationsTest {
    final SpotifyService spotify = mock(SpotifyService.class);
    final LastfmService lastfm = mock(LastfmService.class);
    final RecommendationService service = new RecommendationService(spotify, lastfm);

    @Test void combinesAcrossSeedsButDoesNotCountDuplicateArtistsFromOneResponseTwice() {
        when(lastfm.getSimilarArtists("Seed A", 10)).thenReturn(List.of(
            new SimilarArtist("Shared", .6), new SimilarArtist(" shared ", .6), new SimilarArtist("Solo", .95)));
        when(lastfm.getSimilarArtists("Seed B", 10)).thenReturn(List.of(new SimilarArtist("Shared", .6)));
        when(spotify.searchArtist(7L, "Shared")).thenReturn(hit("shared", "Shared"));
        when(spotify.searchArtist(7L, "Solo")).thenReturn(hit("solo", "Solo"));
        var result = service.recommendArtists(7L, List.of(new TopTrack("One", "Seed A"), new TopTrack("Two", "Seed B")));
        assertThat(result).extracting(RecommendationService.RecommendedArtist::name).containsExactly("Shared", "Solo");
        assertThat(result.getFirst().basedOn()).containsExactly("Seed A", "Seed B");
    }

    @Test void selectsFiveMostFrequentArtistsAndExcludesEveryKnownArtistByNameOrSpotifyId() {
        var tracks = new ArrayList<TopTrack>();
        IntStream.range(0, 7).forEach(i -> tracks.add(new TopTrack("Song" + i, "Seed " + i)));
        tracks.add(new TopTrack("Again", "Seed 6"));
        tracks.add(new TopTrack("Collab", "Seed 6", List.of(new ArtistRef("Seed 6", "known"), new ArtistRef("Guest", "guest"))));
        when(lastfm.getSimilarArtists(anyString(), eq(10))).thenReturn(List.of(new SimilarArtist("Seed 5", 1), new SimilarArtist("Alias", .8)));
        when(spotify.searchArtist(7L, "Alias")).thenReturn(hit("known", "Alias"));
        assertThat(service.recommendArtists(7L, tracks)).isEmpty();
        verify(lastfm).getSimilarArtists("Seed 6", 10);
        verify(lastfm, times(5)).getSimilarArtists(anyString(), eq(10));
        verify(spotify, never()).searchArtist(7L, "Seed 5");
    }

    @Test void resolvesAtMostFifteenCandidatesAndReturnsAtMostThreeDistinctSpotifyArtists() {
        when(lastfm.getSimilarArtists(anyString(), eq(10))).thenAnswer(call ->
            IntStream.range(0, 10).mapToObj(i -> new SimilarArtist(call.getArgument(0) + " " + i, 1 - i * .01)).toList());
        var seeds = List.of(new TopTrack("One", "A"), new TopTrack("Two", "B"));
        assertThat(service.recommendArtists(7L, seeds)).isEmpty();
        verify(spotify, times(15)).searchArtist(eq(7L), anyString());
        reset(spotify);
        when(spotify.searchArtist(eq(7L), anyString())).thenAnswer(call -> hit(call.getArgument(1), call.getArgument(1)));
        assertThat(service.recommendArtists(7L, seeds)).hasSize(3);
    }

    @Test void aliasesResolvingToSameIdCombineTheirEvidence() {
        when(lastfm.getSimilarArtists("Seed", 10)).thenReturn(List.of(new SimilarArtist("Alias A", .8), new SimilarArtist("Alias B", .7)));
        when(spotify.searchArtist(7L, "Alias A")).thenReturn(hit("same", "Actual"));
        when(spotify.searchArtist(7L, "Alias B")).thenReturn(hit("same", "Actual"));
        assertThat(service.recommendArtists(7L, List.of(new TopTrack("Song", "Seed")))).hasSize(1);
    }

    @Test void emptyInputAndCancellationNeverCallProviders() {
        assertThat(service.recommendArtists(7L, List.of())).isEmpty();
        Thread.currentThread().interrupt();
        try {
            assertThatThrownBy(() -> service.recommendArtists(7L, List.of(new TopTrack("Song", "Seed"))))
                .isInstanceOf(IllegalStateException.class);
        } finally { Thread.interrupted(); }
        verifyNoInteractions(spotify, lastfm);
    }

    static ArtistHit hit(String id, String name) { return new ArtistHit(id, name, "spotify:artist:" + id, ""); }
}
