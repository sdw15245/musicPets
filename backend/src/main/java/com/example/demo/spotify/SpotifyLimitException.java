package com.example.demo.spotify;

import java.time.Instant;

/** Spotify Web API 사용 제한. 인증 실패와 구분하며 토큰은 유지한다. */
public class SpotifyLimitException extends RuntimeException {
    public record Limit(String error, String message, long retryAfterSeconds, Instant retryAt) {}
    private final Limit limit;

    public SpotifyLimitException(Limit limit) {
        super(limit.message());
        this.limit = limit;
    }

    public Limit limit() { return limit; }
}
