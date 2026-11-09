package com.example.demo.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/** JWT access/refresh 토큰 생성·검증·파싱. jjwt 라이브러리 래핑. */
@Component
public class JwtTokenProvider {

    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_REFRESH = "refresh";

    private final SecretKey key;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration.access}") long accessExpirationMs,
            @Value("${jwt.expiration.refresh}") long refreshExpirationMs
    ) {
        if (secret == null || secret.isBlank() || secret.contains("${") || secret.startsWith("change-me")) {
            throw new IllegalStateException("JWT_SECRET must be configured with a unique, randomly generated secret");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirationMs = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    public String createAccessToken(Long userId) {
        return build(userId, TYPE_ACCESS, accessExpirationMs);
    }

    public String createRefreshToken(Long userId) {
        return build(userId, TYPE_REFRESH, refreshExpirationMs);
    }

    public long getRefreshExpirationMs() {
        return refreshExpirationMs;
    }

    public Long getUserId(String token) {
        return Long.parseLong(parse(token).getSubject());
    }

    public boolean isAccessToken(String token) {
        return TYPE_ACCESS.equals(parse(token).get("type", String.class));
    }

    public boolean isRefreshToken(String token) {
        return TYPE_REFRESH.equals(parse(token).get("type", String.class));
    }

    public boolean validate(String token) {
        try {
            parse(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private String build(Long userId, String type, long expirationMs) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("type", type)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
