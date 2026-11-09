package com.example.demo.lastfm;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.properties의 lastfm.* 값 바인딩. */
@ConfigurationProperties(prefix = "lastfm")
public class LastfmProperties {

    private String apiKey;
    private String baseUrl;

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
}
