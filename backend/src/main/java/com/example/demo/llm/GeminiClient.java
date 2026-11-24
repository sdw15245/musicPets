package com.example.demo.llm;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.HashMap;
import java.util.Map;

/** Gemini generateContent API 호출. 텍스트 in/out 단순 래퍼. */
@Component
public class GeminiClient {

    private final GeminiProperties props;
    private final RestClient restClient;

    public GeminiClient(GeminiProperties props, RestClient.Builder builder) {
        this.props = props;
        this.restClient = builder.baseUrl(props.getBaseUrl()).build();
    }

    /** 기본 생성 설정을 사용한다. HTTP 오류는 호출자에게 전달한다. */
    public String generate(String prompt) {
        return generate(prompt, Map.of());
    }

    /** 계산된 취향의 해설처럼 별도 추론이 필요하지 않은 호출에 사용한다. */
    public String generateWithoutThinking(String prompt) {
        return generate(prompt, Map.of("thinkingConfig", Map.of("thinkingBudget", 0)));
    }

    private String generate(String prompt, Map<String, Object> generationConfig) {
        Map<String, Object> body = new HashMap<>(Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(Map.of("text", prompt))
                ))
        ));
        if (!generationConfig.isEmpty()) body.put("generationConfig", generationConfig);

        GenerateResponse response = restClient.post()
                .uri("/models/{model}:generateContent", props.getModel())
                .header("x-goog-api-key", props.getApiKey())
                .body(body)
                .retrieve()
                .body(GenerateResponse.class);
        return response == null ? "" : response.firstText();
    }

    /** 응답 중 첫 후보의 첫 텍스트만 읽는다. 빈 응답·안전 차단 등으로 없으면 빈 문자열. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record GenerateResponse(List<Candidate> candidates) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        record Candidate(Content content) {}

        @JsonIgnoreProperties(ignoreUnknown = true)
        record Content(List<Part> parts) {}

        @JsonIgnoreProperties(ignoreUnknown = true)
        record Part(String text) {}

        String firstText() {
            if (candidates == null || candidates.isEmpty() || candidates.getFirst() == null) return "";
            Content content = candidates.getFirst().content();
            if (content == null || content.parts() == null || content.parts().isEmpty() || content.parts().getFirst() == null) return "";
            String text = content.parts().getFirst().text();
            return text == null ? "" : text;
        }
    }
}
