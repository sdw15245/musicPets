package com.example.demo.spotify;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.client.ClientHttpResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/** 이 서버의 모든 사용자에게 대기를 공유한다. Spotify quota 자체의 초기화 시각을 추정하지 않는다. */
class SpotifyRequestGuard {
    private final Clock clock;
    private final ObjectMapper mapper = new ObjectMapper();
    private Instant blockedUntil = Instant.MIN;
    private boolean quotaExceeded;

    SpotifyRequestGuard() { this(Clock.systemUTC()); }
    SpotifyRequestGuard(Clock clock) { this.clock = clock; }

    synchronized void check() {
        if (clock.instant().isBefore(blockedUntil)) throw currentLimit();
    }

    synchronized void reject(ClientHttpResponse response) {
        boolean quota = false;
        try {
            var body = mapper.readTree(response.getBody());
            quota = body != null && "QUOTA_EXCEEDED".equals(body.path("error").path("reason").asText());
        } catch (IOException ignored) {
            // 빈 응답/잘못된 JSON이어도 429의 대기 처리는 유지한다.
        }
        // Retry-After가 없거나 잘못된 경우의 자체 backoff. quota 리셋 시간이 아니다.
        long seconds = quota ? 60 : 30;
        Instant now = clock.instant();
        Instant until = now.plusSeconds(seconds);
        try {
            long supplied = Long.parseLong(response.getHeaders().getFirst("Retry-After"));
            if (supplied >= 0) until = now.plusSeconds(Math.max(1, supplied));
        } catch (NumberFormatException | java.time.DateTimeException | ArithmeticException ignored) { }
        if (!now.isBefore(blockedUntil)) quotaExceeded = quota;
        else quotaExceeded |= quota;
        if (until.isAfter(blockedUntil)) blockedUntil = until;
        throw currentLimit();
    }

    private SpotifyLimitException currentLimit() {
        Duration remaining = Duration.between(clock.instant(), blockedUntil);
        long seconds = Math.max(1, remaining.getSeconds() + (remaining.getNano() > 0 ? 1 : 0));
        return new SpotifyLimitException(new SpotifyLimitException.Limit(
                quotaExceeded ? "SPOTIFY_QUOTA_EXCEEDED" : "SPOTIFY_RATE_LIMITED",
                quotaExceeded ? "Spotify 사용량 한도에 도달했어요." : "Spotify 요청이 잠시 제한됐어요.",
                seconds, blockedUntil));
    }
}
