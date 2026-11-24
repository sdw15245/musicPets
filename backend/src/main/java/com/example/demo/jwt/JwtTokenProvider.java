package com.example.demo.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

/** JWT access/refresh 토큰 생성·검증. jjwt 라이브러리 래핑. */
@Component
public class JwtTokenProvider {

    public enum TokenType {
        ACCESS("access"), REFRESH("refresh");

        private final String claim;

        TokenType(String claim) { this.claim = claim; }
    }

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
        return build(userId, TokenType.ACCESS, accessExpirationMs);
    }

    public String createRefreshToken(Long userId) {
        return build(userId, TokenType.REFRESH, refreshExpirationMs);
    }

    public long getRefreshExpirationMs() {
        return refreshExpirationMs;
    }

    /**
     * 서명·만료·토큰 종류가 모두 맞으면 사용자 ID를 돌려준다. 하나라도 틀리면 empty.
     * 토큰은 한 번만 파싱하며 실패 이유는 구분하지 않는다(호출자에게 알려줄 정보가 아니다).
     */
    public Optional<Long> verify(String token, TokenType expected) {
        if (token == null || token.isBlank()) return Optional.empty();
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if (!expected.claim.equals(claims.get("type", String.class))) return Optional.empty();
            return Optional.of(Long.parseLong(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException invalid) {
            // IllegalArgumentException은 빈 토큰과 숫자가 아닌 subject(NumberFormatException)를 포함한다.
            return Optional.empty();
        }
    }

    private String build(Long userId, TokenType type, long expirationMs) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("type", type.claim)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }
}
