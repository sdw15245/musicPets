package com.example.demo.analysis;

import com.example.demo.recommendation.RecommendationService;
import com.example.demo.recommendation.InvalidPlaylistException;
import org.junit.jupiter.api.Test;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestClientException;
import org.springframework.http.MediaType;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AnalysisExceptionHandlerTest {
    private final AnalysisService analysis = mock(AnalysisService.class);
    private final RecommendationService recommendations = mock(RecommendationService.class);
    private final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new AnalysisController(analysis, recommendations, mock(AnalysisStorage.class)))
            .setControllerAdvice(new AnalysisExceptionHandler())
            .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();

    @Test void progressiveHeaderReturnsTheCoreWithoutInvokingTheFullPipeline() throws Exception {
        mvc.perform(post("/api/analysis").header("X-Analysis-Mode", "progressive")).andExpect(status().isOk());
        verify(analysis).start(any());
        verifyNoMoreInteractions(analysis);
    }

    @Test void externalFailureAndProgrammingErrorHaveDifferentContracts() throws Exception {
        when(analysis.analyze(any())).thenThrow(new RestClientException("secret upstream URL"))
                .thenThrow(new IllegalArgumentException("internal bug"));
        mvc.perform(post("/api/analysis")).andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("EXTERNAL_SERVICE_FAILED"));
        mvc.perform(post("/api/analysis")).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("ANALYSIS_FAILED"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("internal bug"))));
    }

    @Test void playlistValidationAndMalformedJsonAreClientErrors() throws Exception {
        when(recommendations.saveAsPlaylist(any(), any(), any())).thenThrow(new InvalidPlaylistException());
        mvc.perform(post("/api/analysis/recommendations/save").contentType(MediaType.APPLICATION_JSON).content("{\"uris\":[]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_PLAYLIST"));
        mvc.perform(post("/api/analysis/recommendations/save").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_REQUEST"));
    }
}
