package com.example.demo.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.security.web.csrf.CsrfToken;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 인증 관련 HTTP 엔드포인트: access 토큰 재발급(/refresh), 로그아웃(/logout). */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AuthCookies cookies;

    public AuthController(AuthService authService, AuthCookies cookies) {
        this.authService = authService;
        this.cookies = cookies;
    }

    @GetMapping("/csrf")
    public ResponseEntity<Map<String, String>> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(Map.of("headerName", token.getHeaderName(), "token", token.getToken()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(
            @CookieValue(name = AuthCookies.REFRESH, required = false) String refresh,
            HttpServletResponse response) {
        try {
            return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                    .body(Map.of("access", authService.refresh(refresh)));
        } catch (InvalidRefreshTokenException e) {
            cookies.clear(response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore())
                    .body(Map.of("error", "SESSION_EXPIRED", "message", "다시 로그인해주세요."));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = AuthCookies.REFRESH, required = false) String refresh,
            HttpServletResponse response) {
        authService.logout(refresh);
        cookies.clear(response);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
