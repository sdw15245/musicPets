package com.example.demo.llm;

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

    @SuppressWarnings("unchecked")
    private String generate(String prompt, Map<String, Object> generationConfig) {
        Map<String, Object> body = new HashMap<>(Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(Map.of("text", prompt))
                ))
        ));
        if (!generationConfig.isEmpty()) body.put("generationConfig", generationConfig);

        Map<String, Object> response = restClient.post()
                .uri("/models/{model}:generateContent", props.getModel())
                .header("x-goog-api-key", props.getApiKey())
                .body(body)
                .retrieve()
                .body(Map.class);

        if (response == null) return "";

        List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
        if (candidates == null || candidates.isEmpty()) return "";

        Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
        if (content == null) return "";

        List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
        if (parts == null || parts.isEmpty()) return "";

        Object text = parts.get(0).get("text");
        return text == null ? "" : text.toString();
    }
}
