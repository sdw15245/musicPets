package com.example.demo.analysis;

import com.example.demo.recommendation.InvalidPlaylistException;
import com.example.demo.spotify.SpotifyReauthorizationRequiredException;
import com.example.demo.spotify.SpotifyLimitException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;
import java.util.Arrays;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice(assignableTypes = AnalysisController.class)
public class AnalysisExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(AnalysisExceptionHandler.class);

    @ExceptionHandler(SpotifyLimitException.class)
    public ResponseEntity<SpotifyLimitException.Limit> spotifyLimit(SpotifyLimitException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", Long.toString(e.limit().retryAfterSeconds()))
                .body(e.limit());
    }

    @ExceptionHandler(SpotifyReauthorizationRequiredException.class)
    public ResponseEntity<Map<String, String>> spotifyReauthorization(SpotifyReauthorizationRequiredException e) {
        // 401은 우리 JWT 갱신용이므로 Spotify 재인증은 별도 코드의 403으로 전달한다.
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "error", "SPOTIFY_REAUTH_REQUIRED", "message", e.getMessage()));
    }

    @ExceptionHandler(AnalysisExpiredException.class)
    public ResponseEntity<Map<String, String>> expired(AnalysisExpiredException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(InvalidPlaylistException.class)
    public ResponseEntity<Map<String, String>> invalidPlaylist(InvalidPlaylistException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "INVALID_PLAYLIST", "message", e.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> invalidBody(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "INVALID_REQUEST", "message", "요청 형식을 확인해주세요."));
    }

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<Map<String, String>> externalFailure(RestClientException e) {
        // 응답 본문·URL·예외 메시지에는 토큰이 포함될 수 있다.
        log.warn("External analysis request failed: type={}, status={}, at={}", e.getClass().getSimpleName(),
                e instanceof RestClientResponseException response ? response.getStatusCode().value() : null,
                applicationFrames(e));
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                "error", "EXTERNAL_SERVICE_FAILED", "message", "음악 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> failed(RuntimeException e) {
        log.error("Internal analysis failure: type={}, at={}", e.getClass().getSimpleName(), applicationFrames(e));
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "error", "ANALYSIS_FAILED", "message", "분석 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."));
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> requestFailure(org.springframework.web.server.ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",
                e.getReason() == null ? "분석 기록을 찾을 수 없어요." : e.getReason()));
    }

    private static java.util.List<StackTraceElement> applicationFrames(Exception e) {
        return Arrays.stream(e.getStackTrace())
                .filter(frame -> frame.getClassName().startsWith("com.example.demo."))
                .limit(8).toList();
    }
}
