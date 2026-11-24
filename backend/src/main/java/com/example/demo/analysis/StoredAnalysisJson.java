package com.example.demo.analysis;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * latest_analyses·analysis_history의 result_json 형식.
 * 저장 형식이 바뀌면 예전 형식은 여기서만 현재 형식으로 읽는다. 지금까지 바뀐 것:
 * <ul>
 *   <li>genres.timeRange 없음: 최근 4주 분석 도입 전 결과. 당시 분석 기간은 최근 6개월(medium_term)이다.</li>
 *   <li>recommendedArtists 없음: 아티스트 추천 도입 전 결과. null 그대로 둔다(AnalysisResult 참고).</li>
 *   <li>profilePending·recommendationsPending 없음: 단계별 분석 도입 전 결과. 모두 끝난 결과(false)로 읽는다.</li>
 * </ul>
 */
final class StoredAnalysisJson {
    private final ObjectMapper mapper;

    StoredAnalysisJson(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    AnalysisResult read(String json) {
        try {
            JsonNode stored = mapper.readTree(json);
            if (stored.path("genres") instanceof ObjectNode genres && !genres.hasNonNull("timeRange")) {
                genres.put("timeRange", "medium_term");
            }
            return mapper.treeToValue(stored, AnalysisResult.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot read stored analysis", e);
        }
    }

    String write(AnalysisResult result) {
        try {
            return mapper.writeValueAsString(result);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot store analysis", e);
        }
    }
}
