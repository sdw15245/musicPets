package com.example.demo.auth;

import com.example.demo.jwt.JwtTokenProvider;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import java.time.Duration;

/** Host-only credential, accessible only to the backend's authentication endpoints. */
@Component
public class AuthCookies {
    public static final String REFRESH = "musicpets_refresh";
    private final boolean secure;
    private final Duration lifetime;

    public AuthCookies(@Value("${app.auth.cookie-secure:true}") boolean secure, JwtTokenProvider tokens) {
        this.secure = secure;
        this.lifetime = Duration.ofMillis(tokens.getRefreshExpirationMs());
    }

    public void set(HttpServletResponse response, String refresh) { write(response, refresh, lifetime); }
    public void clear(HttpServletResponse response) { write(response, "", Duration.ZERO); }

    private void write(HttpServletResponse response, String value, Duration maxAge) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(REFRESH, value)
                .httpOnly(true).secure(secure).sameSite("Lax").path("/api/auth")
                .maxAge(maxAge).build().toString());
    }
}
