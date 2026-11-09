package com.example.demo.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(AuthExceptionHandler.class);

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> unavailable(RuntimeException error) {
        log.error("auth_request_failed exception={}", error.getClass().getSimpleName());
        return ResponseEntity.status(503).cacheControl(CacheControl.noStore())
                .body(Map.of("error", "AUTH_UNAVAILABLE", "message", "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요."));
    }
}
