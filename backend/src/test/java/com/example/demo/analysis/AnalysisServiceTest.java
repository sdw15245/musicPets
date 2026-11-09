package com.example.demo.analysis;

import com.example.demo.genre.GenreDictionary;
import com.example.demo.genre.NormalizationService;
import com.example.demo.genre.UserVectorService;
import com.example.demo.lastfm.LastfmService;
import com.example.demo.lastfm.LastfmTag;
import com.example.demo.matching.CosineSimilarity;
import com.example.demo.matching.MatchService;
import com.example.demo.recommendation.RecommendationService;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.spotify.SpotifyReauthorizationRequiredException;
import com.example.demo.spotify.SpotifyLimitException;
import java.time.Instant;
import com.example.demo.taste.TasteCommentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(OutputCaptureExtension.class)
class AnalysisServiceTest {
    private final SpotifyService spotify = mock(SpotifyService.class);
    private final LastfmService lastfm = mock(LastfmService.class);
    private final NormalizationService normalization = mock(NormalizationService.class);
    private final TasteCommentService taste = mock(TasteCommentService.class);
    private final AnalysisStorage storage = mock(AnalysisStorage.class);
    private final RecommendationService recommendations = new RecommendationService(spotify, lastfm);
    private final AnalysisService service = new AnalysisService(spotify, lastfm,
            new UserVectorService(normalization), new MatchService(new CosineSimilarity()), taste, recommendations, storage);

    @BeforeEach
    void setup() {
        var stored = new java.util.concurrent.atomic.AtomicReference<AnalysisResult>();
        doAnswer(call -> { stored.set(call.getArgument(1)); return null; }).when(storage).save(eq(7L), any());
        when(storage.latest(7L)).thenAnswer(call -> Optional.ofNullable(stored.get()));
        when(storage.updateCurrent(eq(7L), anyString(), any())).thenAnswer(call ->
                stored.updateAndGet(call.<java.util.function.UnaryOperator<AnalysisResult>>getArgument(2)));
        when(spotify.getTopTracks(7L, 20)).thenReturn(List.of(new SpotifyService.TopTrack("Seed", "Artist")));
        when(lastfm.getTrackTags("Artist", "Seed")).thenReturn(List.of(new LastfmTag("electronic", 100)));
        when(normalization.normalizeAll(List.of("electronic"))).thenReturn(Map.of("electronic", Optional.of("electronic")));
        when(lastfm.getTrackListeners("Artist", "Seed")).thenReturn(100_000L);
        when(taste.comment(anyMap(), any(), any())).thenReturn("전자음악을 즐겨 듣네요.");
        when(lastfm.getSimilarArtists("Artist", 10)).thenReturn(List.of(new LastfmService.SimilarArtist("Other", 0.8)));
        when(spotify.searchArtist(7L, "Other")).thenReturn(new SpotifyService.ArtistHit("abc", "Other", "spotify:artist:abc", ""));
    }

    @AfterEach
    void closeExecutor() {
        service.shutdown();
    }

    @Test
    void profileExplainsThePetAlreadySavedByTheMatchingStep() {
        var core = service.start(7L);
        service.completeProfile(7L, core.id());
        verify(taste).comment(eq(core.genres().vector()), any(), eq(core.character().slug()));
    }

    @Test
    void petAnalysisUsesUpToTwentyTracksWithoutWaitingForOptionalFeatures() {
        var tracks = java.util.stream.IntStream.range(0, 20)
                .mapToObj(i -> new SpotifyService.TopTrack("Song " + i, "Artist")).toList();
        when(spotify.getTopTracks(7L, 20)).thenReturn(tracks);
        var result = service.start(7L);
        assertThat(result.genres().trackCount()).isEqualTo(20);
        assertThat(result.genres().timeRange()).isEqualTo("short_term");
        verify(spotify, never()).getTopTracks(anyLong(), anyInt(), anyString());
        verifyNoInteractions(taste);
        verify(lastfm, never()).getSimilarArtists(anyString(), anyInt());
    }

    @Test
    void progressiveAnalysisReturnsThePetBeforeStartingDetailsAndSongsCanFinishWhileAiWaits() throws Exception {
        CountDownLatch commenting = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(taste.comment(anyMap(), any(), any())).thenAnswer(call -> {
            commenting.countDown();
            if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("timed out");
            return "나만의 AI 코멘트";
        });
        AnalysisResult core = service.start(7L);
        assertThat(core.character().slug()).isEqualTo("pip");
        assertThat(core.profilePending() && core.recommendationsPending()).isTrue();
        verifyNoInteractions(taste);
        verify(lastfm, never()).getSimilarArtists(anyString(), anyInt());
        assertThatThrownBy(() -> service.completeProfile(8L, core.id())).isInstanceOf(AnalysisExpiredException.class);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var profile = executor.submit(() -> service.completeProfile(7L, core.id()));
            try {
                assertThat(commenting.await(2, TimeUnit.SECONDS)).isTrue();
                var songs = service.completeRecommendations(7L, core.id());
                assertThat(songs.recommendedArtists()).hasSize(1);
                assertThat(songs.profilePending()).isTrue();
                assertThat(songs.recommendationsPending()).isFalse();
            } finally { release.countDown(); }
            assertThat(profile.get(2, TimeUnit.SECONDS).profile().comment()).isEqualTo("나만의 AI 코멘트");
            var stored = service.completeProfile(7L, core.id());
            assertThat(stored.recommendedArtists()).hasSize(1);
            verify(taste).comment(anyMap(), any(), any());
            verify(spotify).getTopTracks(7L, 20);
        }
    }

    @Test
    void onePipelineFeedsEveryResultAndExplicitRequestsStartFresh() {
        AnalysisResult result = service.analyze(7L);
        assertThat(result.genres().vector()).containsEntry("electronic", 1.0).hasSize(GenreDictionary.MAIN_GENRES.size());
        assertThat(result.character().slug()).isEqualTo("pip");
        assertThat(result.profile().mainstream()).isEqualTo(60.0);
        assertThat(result.profile().comment()).isEqualTo("전자음악을 즐겨 듣네요.");
        assertThat(result.recommendedArtists()).extracting(RecommendationService.RecommendedArtist::uri).containsExactly("spotify:artist:abc");
        verify(spotify, times(1)).getTopTracks(7L, 20);
        verify(lastfm, times(1)).getTrackTags("Artist", "Seed");
        verify(normalization, times(1)).normalizeAll(anyList());
        assertThat(service.analyze(7L).id()).isNotEqualTo(result.id());
        verify(spotify, times(2)).getTopTracks(7L, 20);
    }

    @Test
    void missingListenerCountsExplainTheCoverageWithoutChangingGenresOrTreatingMissingAsZero() {
        when(spotify.getTopTracks(7L, 20)).thenReturn(List.of(
                new SpotifyService.TopTrack("Seed", "Artist"), new SpotifyService.TopTrack("Missing", "Artist")));
        AnalysisResult result = service.analyze(7L);
        assertThat(result.profile().mainstream()).isEqualTo(60.0);
        assertThat(result.genres().trackCount()).isEqualTo(2);
        assertThat(result.warnings()).contains("분석한 2곡 중 1곡의 Last.fm 청취자 수를 확인했어요. 대중성은 이 1곡으로 계산했어요.");
    }

    @Test
    void unavailableListenersDoNotPretendToMeasureMainstreamness() {
        when(lastfm.getTrackListeners("Artist", "Seed")).thenReturn(0L);
        AnalysisResult result = service.analyze(7L);
        assertThat(result.profile().mainstream()).isNull();
        assertThat(result.warnings()).contains("분석한 1곡 모두 Last.fm 청취자 수를 확인하지 못해 대중성을 계산하지 않았어요.");
    }

    @Test
    void stageTimingsShareAnAnalysisIdWithoutLoggingMusicOrAccountData(CapturedOutput output) {
        AnalysisResult result = service.analyze(7L);

        for (String stage : List.of("spotify_top_tracks", "lastfm_tags", "genre_normalization",
                "character_match", "lastfm_listeners", "taste_comment", "profile", "recommendations", "total")) {
            assertThat(output.getOut()).containsPattern("analysis_timing run_id=" + result.id()
                    + " stage=" + stage + " outcome=completed elapsed_ms=\\d+");
        }
        assertThat(output.getOut()).doesNotContain("Artist", "Seed", "전자음악을 즐겨 듣네요.", "user_id=");
    }

    @Test
    void failedStageAndTotalAreTimedWithoutLoggingExceptionDetails(CapturedOutput output) {
        when(spotify.getTopTracks(7L, 20)).thenThrow(new IllegalStateException("sensitive-token-and-url"));

        assertThatThrownBy(() -> service.analyze(7L)).isInstanceOf(IllegalStateException.class);
        assertThat(output.getOut()).contains("stage=spotify_top_tracks outcome=failed elapsed_ms=",
                        "stage=total outcome=failed elapsed_ms=")
                .doesNotContain("sensitive-token-and-url", "stage=lastfm_tags");
    }

    @Test
    void coreFailureIsNotCachedAndCanBeRetried() {
        when(lastfm.getTrackTags("Artist", "Seed")).thenThrow(new IllegalStateException("offline"))
                .thenReturn(List.of(new LastfmTag("electronic", 100)));
        assertThatThrownBy(() -> service.analyze(7L)).isInstanceOf(IllegalStateException.class);
        assertThat(service.analyze(7L).character().slug()).isEqualTo("pip");
    }

    @Test
    void recommendationRetryKeepsAnalysisAndEnforcesOwnership() {
        when(lastfm.getSimilarArtists("Artist", 10)).thenThrow(new IllegalStateException("offline"))
                .thenReturn(List.of(new LastfmService.SimilarArtist("Other", 0.8)));
        AnalysisResult result = service.analyze(7L);
        assertThat(result.character().slug()).isEqualTo("pip");
        assertThat(result.recommendationsAvailable()).isFalse();
        assertThatThrownBy(() -> service.retryRecommendations(8L, result.id())).isInstanceOf(AnalysisExpiredException.class);
        AnalysisResult retried = service.retryRecommendations(7L, result.id());
        assertThat(retried.id()).isEqualTo(result.id());
        assertThat(retried.recommendationsAvailable()).isTrue();
        assertThat(retried.recommendedArtists()).hasSize(1);
        verify(spotify, times(1)).getTopTracks(7L, 20);
        verify(lastfm, times(1)).getTrackTags("Artist", "Seed");
    }

    @Test
    void absentHistoryDoesNotInventMatchOrObscurity() {
        when(spotify.getTopTracks(7L, 20)).thenReturn(List.of());
        when(spotify.getTopTracks(7L, 20, "medium_term")).thenReturn(List.of());
        when(normalization.normalizeAll(List.of())).thenReturn(Map.of());
        AnalysisResult result = service.analyze(7L);
        assertThat(result.character()).isNull();
        assertThat(result.profile().mainstream()).isNull();
        assertThat(result.profile().obscurity()).isNull();
        assertThat(result.genres().trackCount()).isZero();
        assertThat(result.genres().timeRange()).isEqualTo("medium_term");
        assertThat(result.warnings()).doesNotContain("최근 4주 청취곡이 없어 최근 6개월 기록으로 분석했어요.");
    }

    @Test
    void emptyRecentHistoryUsesSixMonthsForMatchDetailsAndRecommendationRetry() {
        when(spotify.getTopTracks(7L, 20)).thenReturn(List.of());
        when(spotify.getTopTracks(7L, 20, "medium_term"))
                .thenReturn(List.of(new SpotifyService.TopTrack("Seed", "Artist")));
        var core = service.start(7L);
        assertThat(core.genres().timeRange()).isEqualTo("medium_term");
        assertThat(core.genres().trackCount()).isEqualTo(1);
        assertThat(core.character()).isNotNull();
        assertThat(core.warnings()).containsExactly("최근 4주 청취곡이 없어 최근 6개월 기록으로 분석했어요.");
        var profile = service.completeProfile(7L, core.id());
        assertThat(profile.profile().comment()).isEqualTo("전자음악을 즐겨 듣네요.");
        var completed = service.completeRecommendations(7L, core.id());
        assertThat(completed.recommendedArtists()).hasSize(1);
        var retried = service.retryRecommendations(7L, core.id());
        assertThat(retried.recommendedArtists()).hasSize(1);
        assertThat(retried.genres().timeRange()).isEqualTo("medium_term");
        assertThat(retried.warnings()).containsExactlyElementsOf(core.warnings());
        verify(spotify, times(1)).getTopTracks(7L, 20);
        verify(spotify, times(1)).getTopTracks(7L, 20, "medium_term");
    }

    @Test
    void tracksWithoutGenresDoNotTriggerASecondPeriod() {
        when(lastfm.getTrackTags("Artist", "Seed")).thenReturn(List.of());
        when(normalization.normalizeAll(List.of())).thenReturn(Map.of());
        var result = service.start(7L);
        assertThat(result.character()).isNull();
        assertThat(result.genres().trackCount()).isEqualTo(1);
        assertThat(result.genres().timeRange()).isEqualTo("short_term");
        verify(spotify, never()).getTopTracks(anyLong(), anyInt(), anyString());
    }

    @Test
    void recentProviderFailureDoesNotTryAnotherPeriodOrReplaceStoredResult() {
        var failure = new org.springframework.web.client.RestClientException("provider unavailable");
        when(spotify.getTopTracks(7L, 20)).thenThrow(failure);
        assertThatThrownBy(() -> service.start(7L)).isSameAs(failure);
        verify(spotify, never()).getTopTracks(anyLong(), anyInt(), anyString());
        verify(storage, never()).save(anyLong(), any());
    }

    @Test
    void fallbackFailureIsNotPresentedAsMissingListeningHistory() {
        when(spotify.getTopTracks(7L, 20)).thenReturn(List.of());
        var failure = new SpotifyReauthorizationRequiredException();
        when(spotify.getTopTracks(7L, 20, "medium_term")).thenThrow(failure);
        assertThatThrownBy(() -> service.start(7L)).isSameAs(failure);
        verify(storage, never()).save(anyLong(), any());
    }

    @Test
    void spotifyReauthorizationDuringRecommendationsIsNotHiddenAsAnOptionalFailure() {
        when(spotify.searchArtist(7L, "Other")).thenThrow(new SpotifyReauthorizationRequiredException());
        assertThatThrownBy(() -> service.analyze(7L))
                .isInstanceOf(SpotifyReauthorizationRequiredException.class);
    }

    @Test
    void recommendationRetryPreservesSpotifyReauthorizationError() {
        AnalysisResult result = service.analyze(7L);
        when(spotify.searchArtist(7L, "Other")).thenThrow(new SpotifyReauthorizationRequiredException());
        assertThatThrownBy(() -> service.retryRecommendations(7L, result.id()))
                .isInstanceOf(SpotifyReauthorizationRequiredException.class);
    }

    @Test
    void concurrentRequestsShareOnePipeline() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch finish = new CountDownLatch(1);
        when(spotify.getTopTracks(7L, 20)).thenAnswer(invocation -> {
            started.countDown();
            if (!finish.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Test timed out");
            return List.of(new SpotifyService.TopTrack("Seed", "Artist"));
        });
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> service.analyze(7L));
            assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
            // 동시 POST는 진행 중인 분석을 공유한다.
            var secondThread = new java.util.concurrent.atomic.AtomicReference<Thread>();
            var second = executor.submit(() -> {
                secondThread.set(Thread.currentThread());
                return service.analyze(7L);
            });
            org.awaitility.Awaitility.await().atMost(5, TimeUnit.SECONDS).until(() ->
                    secondThread.get() != null && secondThread.get().getState() == Thread.State.WAITING);
            finish.countDown();
            assertThat(second.get(5, TimeUnit.SECONDS)).isSameAs(first.get(5, TimeUnit.SECONDS));
            verify(spotify, times(1)).getTopTracks(7L, 20);
        } finally {
            finish.countDown();
        }
    }

    @Test
    void quotaDuringRecommendationsPreservesCoreAndRetryReportsLimit() {
        var limit = new SpotifyLimitException.Limit("SPOTIFY_QUOTA_EXCEEDED", "Limit", 120, Instant.now().plusSeconds(120));
        when(spotify.searchArtist(7L, "Other")).thenThrow(new SpotifyLimitException(limit));
        AnalysisResult result = service.analyze(7L);
        assertThat(result.character().slug()).isEqualTo("pip");
        assertThat(result.recommendationsAvailable()).isFalse();
        // Inspect the serialized contract so dropping a limit during async fallback is observable.
        var json = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().valueToTree(result);
        assertThat(json.path("recommendationLimit").path("error").asText()).isEqualTo("SPOTIFY_QUOTA_EXCEEDED");
        assertThatThrownBy(() -> service.retryRecommendations(7L, result.id())).isInstanceOf(SpotifyLimitException.class);
        doReturn(new SpotifyService.ArtistHit("abc", "Other", "spotify:artist:abc", ""))
                .when(spotify).searchArtist(7L, "Other");
        var recovered = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules()
                .valueToTree(service.retryRecommendations(7L, result.id()));
        assertThat(recovered.path("recommendationLimit").isNull()).isTrue();
    }

    @Test
    void slowOptionalRequestsKeepTheCoreResultWithinTheDeadline(CapturedOutput output) throws Exception {
        ReflectionTestUtils.setField(service, "optionalTimeoutMs", 50L);
        CountDownLatch release = new CountDownLatch(1);
        when(lastfm.getTrackListeners("Artist", "Seed")).thenAnswer(invocation -> {
            release.await(5, TimeUnit.SECONDS);
            return 100_000L;
        });
        when(lastfm.getSimilarArtists("Artist", 10)).thenAnswer(invocation -> {
            release.await(5, TimeUnit.SECONDS);
            return List.of();
        });
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            AnalysisResult result = executor.submit(() -> service.analyze(7L)).get(2, TimeUnit.SECONDS);
            assertThat(result.character().slug()).isEqualTo("pip");
            assertThat(result.genres().vector()).containsEntry("electronic", 1.0);
            assertThat(result.profile().comment()).isNotBlank();
            assertThat(result.recommendationsAvailable()).isFalse();
            assertThat(output.getOut()).contains("analysis_timeout run_id=" + result.id()
                            + " stage=profile shared_budget_ms=50",
                    "run_id=" + result.id() + " stage=total outcome=completed elapsed_ms=");
        } finally {
            release.countDown();
        }
    }
}
