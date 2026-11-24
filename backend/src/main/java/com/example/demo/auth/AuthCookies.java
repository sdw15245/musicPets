package com.example.demo.auth;

import com.example.demo.jwt.JwtTokenProvider;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import java.time.Duration;

/** 인증 쿠키(refresh, CSRF) 규칙. 이 백엔드 호스트의 인증 경로에서만, 스크립트 접근 없이 쓴다. */
@Component
public class AuthCookies {
    public static final String REFRESH = "musicpets_refresh";
    private final boolean secure;
    private final Duration lifetime;

    /** 로컬 HTTP 개발에서만 secure=false(AUTH_COOKIE_SECURE). */
    public AuthCookies(@Value("${app.auth.cookie-secure:true}") boolean secure, JwtTokenProvider tokens) {
        this.secure = secure;
        this.lifetime = Duration.ofMillis(tokens.getRefreshExpirationMs());
    }

    public void set(HttpServletResponse response, String refresh) { write(response, refresh, lifetime); }
    public void clear(HttpServletResponse response) { write(response, "", Duration.ZERO); }

    /** refresh 쿠키와 CSRF 쿠키가 함께 쓰는 속성. */
    public ResponseCookie.ResponseCookieBuilder configure(ResponseCookie.ResponseCookieBuilder cookie) {
        return cookie.httpOnly(true).secure(secure).sameSite("Lax").path("/api/auth");
    }

    private void write(HttpServletResponse response, String value, Duration maxAge) {
        response.addHeader(HttpHeaders.SET_COOKIE,
                configure(ResponseCookie.from(REFRESH, value)).maxAge(maxAge).build().toString());
    }
}
