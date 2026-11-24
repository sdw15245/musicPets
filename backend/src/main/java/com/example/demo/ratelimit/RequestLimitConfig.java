package com.example.demo.ratelimit;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** 인증 엔드포인트는 제외한다. 로그인 유지(refresh)가 다른 요청 예산 때문에 막히면 안 된다. */
@Configuration
public class RequestLimitConfig implements WebMvcConfigurer {
    private final RequestGuard guard;

    public RequestLimitConfig(RequestGuard guard) {
        this.guard = guard;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new RequestLimitInterceptor(guard))
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/**");
    }
}
