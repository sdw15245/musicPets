package com.example.demo.auth;

import com.example.demo.error.ApiError;
import com.example.demo.error.ErrorCode;
import com.example.demo.error.FallbackError;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.security.web.csrf.CsrfToken;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 인증 관련 HTTP 엔드포인트: access 토큰 재발급(/refresh), 로그아웃(/logout).
 * 저장소 장애는 401이 아니라 재시도 가능한 503으로 알려 프론트가 로그인 정보를 지우지 않게 한다.
 */
@RestController
@RequestMapping("/api/auth")
@FallbackError(ErrorCode.AUTH_UNAVAILABLE)
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
    public ResponseEntity<?> refresh(
            @CookieValue(name = AuthCookies.REFRESH, required = false) String refresh,
            HttpServletResponse response) {
        try {
            return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                    .body(Map.of("access", authService.refresh(refresh)));
        } catch (InvalidRefreshTokenException e) {
            // 만료된 쿠키를 함께 지워야 하므로 전역 처리기로 넘기지 않고 여기서 응답한다.
            cookies.clear(response);
            return ResponseEntity.status(ErrorCode.SESSION_EXPIRED.status()).cacheControl(CacheControl.noStore())
                    .body(ApiError.of(ErrorCode.SESSION_EXPIRED));
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
