package com.example.demo.ratelimit;

import com.example.demo.analysis.AnalysisService;
import com.example.demo.community.PostService;
import com.example.demo.jwt.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.rate-limit.enabled=true", "app.rate-limit.max-concurrent-external=1",
        "app.rate-limit.ip-per-minute.analysis=2", "app.rate-limit.user-per-minute.read=2", "app.rate-limit.ip-per-minute.read=3"})
@ActiveProfiles("test") @AutoConfigureMockMvc
class RequestLimitIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider tokens;
    @MockitoBean AnalysisService analysis;
    @MockitoBean PostService posts;
    String ip() { return "test-" + UUID.randomUUID(); }
    String auth(long id) { return "Bearer " + tokens.createAccessToken(id); }

    @Test void authenticatedIdentityControlsBudgetAcrossAddressesAndReturnsRetryMetadata() throws Exception {
        mvc.perform(post("/api/analysis").header("Authorization", auth(91001)).with(r -> { r.setRemoteAddr(ip()); return r; }))
                .andExpect(status().isOk());
        mvc.perform(post("/api/analysis").header("Authorization", auth(91001)).header("Origin", "http://127.0.0.1:5173")
                        .with(r -> { r.setRemoteAddr(ip()); return r; }))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.error").value("APP_RATE_LIMITED"))
                .andExpect(jsonPath("$.operation").value("ANALYSIS")).andExpect(jsonPath("$.retryAfterSeconds").isNumber())
                .andExpect(jsonPath("$.retryAt").isString()).andExpect(header().exists("Retry-After"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Access-Control-Expose-Headers", "Retry-After"));
        verify(analysis, times(1)).analyze(91001L);
    }

    @Test void publicReadsShareSocketAddressBudgetAndIgnoreSpoofedForwardedHeaders() throws Exception {
        String ip = ip();
        for (int i = 0; i < 3; i++) mvc.perform(get("/api/posts").header("X-Forwarded-For", "192.0.2." + i)
                        .with(r -> { r.setRemoteAddr(ip); return r; })).andExpect(status().isOk());
        mvc.perform(get("/api/posts").header("Forwarded", "for=192.0.2.99").header("X-Forwarded-For", "192.0.2.99")
                        .with(r -> { r.setRemoteAddr(ip); return r; }))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.operation").value("READ"));
        verify(posts, times(3)).list(isNull(), anyString(), anyString(), isNull(), anyInt(), anyString(), anyString());
    }

    @Test void unauthenticatedRequestsRemainUnauthorizedAndPreflightIsNotThrottled() throws Exception {
        mvc.perform(post("/api/analysis")).andExpect(status().isUnauthorized());
        verifyNoInteractions(analysis);
        for (int i = 0; i < 5; i++) mvc.perform(options("/api/analysis").header("Origin", "http://127.0.0.1:5173")
                        .header("Access-Control-Request-Method", "POST")).andExpect(status().isOk());
    }

    @Test void failedControllerReleasesConcurrencyPermit() throws Exception {
        when(analysis.analyze(91002L)).thenThrow(new IllegalStateException("test-failure"));
        String ip = ip();
        mvc.perform(post("/api/analysis").header("Authorization", auth(91002)).with(r -> { r.setRemoteAddr(ip); return r; }))
                .andExpect(status().isInternalServerError());
        mvc.perform(post("/api/analysis").header("Authorization", auth(91003)).with(r -> { r.setRemoteAddr(ip); return r; }))
                .andExpect(status().isOk());
        verify(analysis).analyze(91003L);
    }

    @Test void classifyEveryExpensiveRouteAndGroupCommunityMutations() {
        org.assertj.core.api.Assertions.assertThat(RequestLimitFilter.classify("POST", "/api/analysis/recommendations/save")).isEqualTo(RequestLimits.Operation.PLAYLIST);
        org.assertj.core.api.Assertions.assertThat(RequestLimitFilter.classify("POST", "/api/analysis/run-id/recommendations")).isEqualTo(RequestLimits.Operation.RECOMMENDATIONS);
        org.assertj.core.api.Assertions.assertThat(RequestLimitFilter.classify("GET", "/api/tracks/search")).isEqualTo(RequestLimits.Operation.SEARCH);
        for (String path : java.util.List.of("/api/posts", "/api/posts/1/comments", "/api/posts/1/like", "/api/me"))
            org.assertj.core.api.Assertions.assertThat(RequestLimitFilter.classify("PUT", path)).isEqualTo(RequestLimits.Operation.WRITE);
    }
}
