package com.example.demo.community;

import com.example.demo.spotify.SpotifyLimitException;
import com.example.demo.spotify.SpotifyReauthorizationRequiredException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import java.util.Map;

@RestControllerAdvice(assignableTypes = {PostController.class, TrackSearchController.class})
public class CommunityExceptionHandler {
    @ExceptionHandler(SpotifyLimitException.class)
    public ResponseEntity<SpotifyLimitException.Limit> limit(SpotifyLimitException error) {
        return ResponseEntity.status(429).header("Retry-After", Long.toString(error.limit().retryAfterSeconds())).body(error.limit());
    }

    @ExceptionHandler(SpotifyReauthorizationRequiredException.class)
    public ResponseEntity<Map<String, String>> reconnect(SpotifyReauthorizationRequiredException error) {
        return ResponseEntity.status(403).body(Map.of("error", "SPOTIFY_REAUTH_REQUIRED", "message", "Spotify에 다시 연결해주세요."));
    }

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<Map<String, String>> spotifyFailure(RestClientException error) {
        if (error instanceof RestClientResponseException response && response.getStatusCode().value() == 404) {
            return ResponseEntity.badRequest().body(Map.of("message", "Spotify에서 이 곡을 찾지 못했어요. 다른 곡을 선택해주세요."));
        }
        return ResponseEntity.status(502).body(Map.of("message", "Spotify에서 곡 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요."));
    }
}
