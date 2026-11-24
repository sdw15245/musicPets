package com.example.demo.analysis;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class StoredAnalysisJsonTest {
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private final StoredAnalysisJson format = new StoredAnalysisJson(mapper);

    private AnalysisResult current(String timeRange) {
        return new AnalysisResult("run", Instant.parse("2026-11-25T00:00:00Z"),
                new AnalysisResult.Genres(Map.of("pop", 1.0), List.of(), 1, 1, timeRange), null,
                new AnalysisResult.Profile(50.0, 50.0, "설명"), List.of(), true, List.of(), null, false, false, List.of());
    }

    /** 현재 형식으로 저장한 JSON에서 필드를 지워 예전 형식을 만든다. */
    private String withoutFields(AnalysisResult result, String... paths) {
        ObjectNode stored = mapper.valueToTree(result);
        for (String path : paths) {
            int dot = path.indexOf('.');
            if (dot < 0) stored.remove(path);
            else ((ObjectNode) stored.path(path.substring(0, dot))).remove(path.substring(dot + 1));
        }
        return stored.toString();
    }

    @Test
    void currentResultsRoundTripUnchanged() {
        var result = current("short_term");
        assertThat(format.read(format.write(result))).isEqualTo(result);
    }

    @Test
    void resultsFromBeforeTheFourWeekPeriodReadAsSixMonths() {
        var old = format.read(withoutFields(current("short_term"), "genres.timeRange"));
        assertThat(old.genres().timeRange()).isEqualTo("medium_term");
    }

    @Test
    void resultsFromBeforeArtistRecommendationsKeepTheLegacyMarker() {
        var old = format.read(withoutFields(current("short_term"), "recommendedArtists"));
        assertThat(old.recommendedArtists()).isNull();
        assertThat(old.recommendations()).isEmpty();
    }

    @Test
    void resultsFromBeforeStagedAnalysisReadAsFinished() {
        var old = format.read(withoutFields(current("short_term"), "profilePending", "recommendationsPending"));
        assertThat(old.profilePending()).isFalse();
        assertThat(old.recommendationsPending()).isFalse();
    }
}
