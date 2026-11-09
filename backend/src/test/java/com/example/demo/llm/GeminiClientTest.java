package com.example.demo.llm;

import com.example.demo.taste.TasteCommentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeminiClientTest {
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private GeminiClient client;
    private static final String RESPONSE = """
            {"candidates":[{"content":{"parts":[{"text":"취향 해설"}]}}]}
            """;

    @BeforeEach
    void setup() {
        var props = new GeminiProperties();
        props.setBaseUrl("https://gemini.test");
        props.setModel("gemini-2.5-flash");
        props.setApiKey("test-key");
        client = new GeminiClient(props, builder);
    }

    @Test
    void tasteCommentDisablesThinkingWithoutLimitingOutputOrChangingDefaultCalls() {
        server.expect(requestTo("https://gemini.test/models/gemini-2.5-flash:generateContent?key=test-key"))
                .andExpect(jsonPath("$.generationConfig.thinkingConfig.thinkingBudget").value(0))
                .andExpect(jsonPath("$.generationConfig.maxOutputTokens").doesNotExist())
                .andRespond(withSuccess(RESPONSE, MediaType.APPLICATION_JSON));
        server.expect(anything())
                .andExpect(jsonPath("$.generationConfig").doesNotExist())
                .andExpect(jsonPath("$.contents[0].parts[0].text").value("분류 프롬프트"))
                .andRespond(withSuccess(RESPONSE, MediaType.APPLICATION_JSON));

        assertThat(new TasteCommentService(client).comment(Map.of("indie", 1.0), null, "sulk-cat"))
                .isEqualTo("취향 해설");
        assertThat(client.generate("분류 프롬프트")).isEqualTo("취향 해설");
        server.verify();
    }
}
