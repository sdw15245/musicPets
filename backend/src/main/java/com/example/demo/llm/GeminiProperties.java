package com.example.demo.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.properties의 gemini.* 값 바인딩. */
@ConfigurationProperties(prefix = "gemini")
public class GeminiProperties {

    private String apiKey;
    private String baseUrl;
    private String model;

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
}
