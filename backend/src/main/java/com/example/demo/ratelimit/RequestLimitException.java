package com.example.demo.ratelimit;

import java.time.Instant;

public class RequestLimitException extends RuntimeException {
    public record Limit(String error, String message, long retryAfterSeconds, Instant retryAt,
                        RequestLimits.Operation operation) {}
    private final Limit limit;
    RequestLimitException(long seconds, Instant now, RequestLimits.Operation operation) {
        super("요청이 많아 잠시 기다려야 해요.");
        limit = new Limit("APP_RATE_LIMITED", getMessage(), seconds, now.plusSeconds(seconds), operation);
    }
    public Limit limit() { return limit; }
}
