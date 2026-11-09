package com.example.demo.config;

import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.time.Duration;

/** 외부 서비스가 응답하지 않을 때도 요청이 끝나 재시도할 수 있도록 제한한다. */
@Configuration
public class ExternalApiConfig {
    @Bean
    public RestClientCustomizer externalApiTimeouts() {
        return builder -> {
            var factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(5));
            factory.setReadTimeout(Duration.ofSeconds(15));
            builder.requestFactory(factory);
        };
    }
}
