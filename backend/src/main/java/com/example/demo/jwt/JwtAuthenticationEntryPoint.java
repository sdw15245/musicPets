package com.example.demo.jwt;

import com.example.demo.error.ErrorCode;
import com.example.demo.error.ErrorResponseWriter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** 인증 실패(401) 시 다른 오류와 같은 JSON 형태로 응답한다. Spring Security 내부 문구는 노출하지 않는다. */
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ErrorResponseWriter errors;

    public JwtAuthenticationEntryPoint(ErrorResponseWriter errors) {
        this.errors = errors;
    }

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        errors.write(response, ErrorCode.UNAUTHORIZED);
    }
}
