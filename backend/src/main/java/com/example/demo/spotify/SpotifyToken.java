package com.example.demo.spotify;

import jakarta.persistence.*;

import java.time.Instant;

/** 사용자별 Spotify access/refresh 토큰 보관. userId가 PK. */
@Entity
@Table(name = "spotify_tokens")
public class SpotifyToken {

    @Id
    private Long userId;

    @Column(nullable = false, length = 1024)
    private String accessToken;

    @Column(length = 1024)
    private String refreshToken;

    @Column(nullable = false)
    private Instant expiresAt;

    protected SpotifyToken() {}

    public SpotifyToken(Long userId, String accessToken, String refreshToken, Instant expiresAt) {
        this.userId = userId;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresAt = expiresAt;
    }

    public Long getUserId() { return userId; }
    public String getAccessToken() { return accessToken; }
    public String getRefreshToken() { return refreshToken; }

    public void update(String accessToken, String refreshToken, Instant expiresAt) {
        this.accessToken = accessToken;
        if (refreshToken != null) {
            this.refreshToken = refreshToken;
        }
        this.expiresAt = expiresAt;
    }

    /** 만료 30초 전부터 만료로 간주 (네트워크 지연 여유). */
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt.minusSeconds(30));
    }
}
