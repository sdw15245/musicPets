package com.example.demo.auth;

import jakarta.persistence.*;

import java.time.Instant;

/** 우리 앱이 발급한 JWT refresh token. 로그아웃 시 DB에서 삭제하면 무효화. */
@Entity
@Table(name = "refresh_tokens", indexes = {
        @Index(name = "idx_refresh_user", columnList = "userId"),
        @Index(name = "idx_refresh_token", columnList = "token", unique = true)
})
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 512)
    private String token;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Instant expiresAt;

    protected RefreshToken() {}

    public RefreshToken(String token, Long userId, Instant expiresAt) {
        this.token = token;
        this.userId = userId;
        this.expiresAt = expiresAt;
    }

    public Long getUserId() { return userId; }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
