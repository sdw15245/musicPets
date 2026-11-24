package com.example.demo.error;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** 컨트롤러 밖(보안·요청 제한 필터)에서 ApiExceptionHandler와 같은 형태로 오류를 쓴다. */
@Component
public class ErrorResponseWriter {
    private final ObjectMapper mapper;

    public ErrorResponseWriter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public void write(HttpServletResponse response, ErrorCode code) throws IOException {
        write(response, code.status().value(), ApiError.of(code));
    }

    /** 대기 시간처럼 ApiError보다 많은 정보를 담는 본문용. */
    public void write(HttpServletResponse response, int status, Object body) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        mapper.writeValue(response.getWriter(), body);
    }
}
