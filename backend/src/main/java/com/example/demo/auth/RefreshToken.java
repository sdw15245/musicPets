package com.example.demo.auth;

import jakarta.persistence.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

/**
 * 우리 앱이 발급한 refresh 토큰의 세션 기록. 로그아웃 시 DB에서 삭제하면 무효화.
 * 원문 대신 SHA-256 해시만 저장한다(V4). DB 백업이 유출돼도 저장값으로는 세션을 이어갈 수 없다.
 * 토큰 자체가 서명된 긴 무작위 값이라 소금(salt) 없이 해시해도 원문을 추측할 수 없다.
 */
@Entity
@Table(name = "refresh_tokens", indexes = {
        @Index(name = "idx_refresh_user", columnList = "userId"),
        @Index(name = "idx_refresh_token", columnList = "token", unique = true)
})
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 열 이름은 V1 그대로 둔다. 이전 앱으로 롤백해도 시작은 되고, 기존 세션만 다시 로그인하면 된다.
    @Column(name = "token", nullable = false, length = 512)
    private String tokenHash;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Instant expiresAt;

    protected RefreshToken() {}

    private RefreshToken(String tokenHash, Long userId, Instant expiresAt) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.expiresAt = expiresAt;
    }

    /** 쿠키로 보낼 원문 토큰의 세션 기록. 원문은 저장하지 않는다. */
    public static RefreshToken issue(String token, Long userId, Instant expiresAt) {
        return new RefreshToken(hash(token), userId, expiresAt);
    }

    /** 조회·삭제 키. MySQL SHA2(token, 256)과 같은 소문자 16진수 64자(V4 마이그레이션과 일치해야 한다). */
    public static String hash(String token) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    public Long getUserId() { return userId; }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
