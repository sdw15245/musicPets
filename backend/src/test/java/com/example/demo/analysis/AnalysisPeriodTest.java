package com.example.demo.analysis;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class AnalysisPeriodTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void oldSavedResultsRemainSixMonthResultsAndNewResultsKeepTheirPeriod() throws Exception {
        String oldJson = "{\"vector\":{},\"unmappedTags\":[],\"tagCount\":0,\"trackCount\":10}";
        var old = mapper.readValue(oldJson, AnalysisResult.Genres.class);
        assertThat(old.timeRange()).isEqualTo("medium_term");
        var recent = mapper.readValue(oldJson.replace("\"trackCount\":10", "\"trackCount\":20,\"timeRange\":\"short_term\""), AnalysisResult.Genres.class);
        assertThat(mapper.readValue(mapper.writeValueAsString(recent), AnalysisResult.Genres.class).timeRange()).isEqualTo("short_term");
    }
}
