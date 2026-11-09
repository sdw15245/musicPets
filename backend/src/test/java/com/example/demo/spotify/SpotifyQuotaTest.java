package com.example.demo.spotify;

import com.example.demo.analysis.AnalysisController;
import com.example.demo.analysis.AnalysisExceptionHandler;
import com.example.demo.analysis.AnalysisService;
import com.example.demo.analysis.AnalysisStorage;
import com.example.demo.recommendation.RecommendationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.anything;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SpotifyQuotaTest {
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final SpotifyTokenService tokens = mock(SpotifyTokenService.class);
    private final SpotifyService spotify = new SpotifyService(tokens, builder);

    @Test
    void topTracksUseRecentFourWeeksAndRequestTwentyItemsInOneCall() {
        when(tokens.getValidAccessToken(7L)).thenReturn("access");
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam("time_range", "short_term"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam("limit", "20"))
                .andRespond(withSuccess("{\"items\":[]}", MediaType.APPLICATION_JSON));
        assertThat(spotify.getTopTracks(7L, 20)).isEmpty();
        server.verify();
    }

    @Test
    void explicitSixMonthLookupUsesTheRequestedPeriodAndLimit() {
        when(tokens.getValidAccessToken(7L)).thenReturn("access");
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam("time_range", "medium_term"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam("limit", "20"))
                .andRespond(withSuccess("{\"items\":[]}", MediaType.APPLICATION_JSON));
        assertThat(spotify.getTopTracks(7L, 20, "medium_term")).isEmpty();
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"items\":null}", "{\"items\":{}}"})
    void malformedTopTracksAreFailuresRatherThanEmptyListeningHistory(String response) {
        when(tokens.getValidAccessToken(7L)).thenReturn("access");
        server.expect(anything()).andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> spotify.getTopTracks(7L, 20))
                .isInstanceOf(org.springframework.web.client.RestClientException.class);
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"QUOTA_EXCEEDED", "RATE_LIMITED"})
    void apiPreservesLimitReasonAndWaitInsteadOfReturning502(String reason) throws Exception {
        when(tokens.getValidAccessToken(any())).thenReturn("access");
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.APPLICATION_JSON).header("Retry-After", "120")
                .body("{\"error\":{\"status\":429,\"message\":\"Too many requests\",\"reason\":\"" + reason + "\"}}"));
        AnalysisService analysis = mock(AnalysisService.class);
        when(analysis.analyze(any())).thenAnswer(invocation -> {
            spotify.getTopTracks(7L, 10);
            throw new AssertionError("Expected limit");
        });
        var mvc = MockMvcBuilders.standaloneSetup(new AnalysisController(analysis, mock(RecommendationService.class), mock(AnalysisStorage.class)))
                .setControllerAdvice(new AnalysisExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        mvc.perform(post("/api/analysis"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("SPOTIFY_" + reason))
                .andExpect(jsonPath("$.retryAfterSeconds").value(120))
                .andExpect(header().string("Retry-After", "120"));
        server.verify();
    }

    @Test
    void cooldownBlocksOtherUsersAndEndpointsWithoutSendingMoreRequests() {
        when(tokens.getValidAccessToken(any())).thenReturn("access");
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", "120").body("{\"error\":{\"reason\":\"QUOTA_EXCEEDED\"}}"));
        assertThatThrownBy(() -> spotify.getTopTracks(7L, 10)).isInstanceOf(RuntimeException.class);
        // Any further HTTP request would fail the mock server's single-request expectation.
        assertThatThrownBy(() -> spotify.searchTracks(8L, "song", 10)).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> spotify.createPlaylist(8L, "name", "description")).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> spotify.addTracksToPlaylist(8L, "id", java.util.List.of("spotify:track:abc")))
                .isInstanceOf(RuntimeException.class);
        verify(tokens, times(1)).getValidAccessToken(any());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "not-json", "{\"error\":{\"message\":\"Too many requests\"}}"})
    void malformedOrMissingReasonStillWaitsAndCanRecover(String body) {
        var now = new java.util.concurrent.atomic.AtomicReference<>(java.time.Instant.parse("2026-09-16T00:00:00Z"));
        var clock = mock(java.time.Clock.class);
        when(clock.instant()).thenAnswer(invocation -> now.get());
        var client = new SpotifyService(tokens, builder, new SpotifyRequestGuard(clock));
        when(tokens.getValidAccessToken(any())).thenReturn("same-access");
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", "invalid").body(body));
        server.expect(anything()).andRespond(withSuccess("{\"items\":[]}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.getTopTracks(7L, 10)).isInstanceOf(SpotifyLimitException.class);
        assertThatThrownBy(() -> client.getTopTracks(8L, 10)).isInstanceOf(SpotifyLimitException.class);
        now.set(now.get().plusSeconds(31));
        assertThat(client.getTopTracks(8L, 10)).isEmpty();
        server.verify();
    }

    @Test
    void suppliedWaitExpiresAtTheBoundaryWithoutExtraTokenLookups() {
        var now = new java.util.concurrent.atomic.AtomicReference<>(java.time.Instant.parse("2026-09-16T00:00:00Z"));
        var clock = mock(java.time.Clock.class);
        when(clock.instant()).thenAnswer(invocation -> now.get());
        var client = new SpotifyService(tokens, builder, new SpotifyRequestGuard(clock));
        when(tokens.getValidAccessToken(any())).thenReturn("same-access");
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", "120").body("{\"error\":{\"reason\":\"QUOTA_EXCEEDED\"}}"));
        server.expect(anything()).andRespond(withSuccess("{\"items\":[]}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.getTopTracks(7L, 10)).isInstanceOf(SpotifyLimitException.class);
        now.set(now.get().plusSeconds(119));
        assertThatThrownBy(() -> client.getTopTracks(7L, 10)).isInstanceOf(SpotifyLimitException.class);
        now.set(now.get().plusSeconds(1));
        assertThat(client.getTopTracks(7L, 10)).isEmpty();
        verify(tokens, times(2)).getValidAccessToken(7L);
        server.verify();
    }
}
