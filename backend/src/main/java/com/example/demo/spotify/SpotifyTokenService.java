package com.example.demo.spotify;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestClientException;
import java.nio.charset.StandardCharsets;

import java.time.Instant;
import java.util.Base64;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.stream.IntStream;

/**
 * Spotify access token 관리.
 * - 만료 안 됐으면 그대로 반환
 * - 만료됐으면 refresh token으로 새 access token 발급 후 DB 갱신
 */
@Service
public class SpotifyTokenService {

    private static final String TOKEN_URL = "https://accounts.spotify.com/api/token";

    private final SpotifyTokenRepository repository;
    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final ObjectMapper objectMapper = new ObjectMapper();
    // 고정 크기 잠금으로 같은 사용자의 갱신을 직렬화한다. 네트워크 대기 중 DB 잠금은 없다.
    private final Object[] refreshLocks = IntStream.range(0, 64).mapToObj(i -> new Object()).toArray();

    public SpotifyTokenService(
            SpotifyTokenRepository repository,
            @Value("${spring.security.oauth2.client.registration.spotify.client-id}") String clientId,
            @Value("${spring.security.oauth2.client.registration.spotify.client-secret}") String clientSecret,
            RestClient.Builder builder
    ) {
        this.repository = repository;
        this.restClient = builder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public String getValidAccessToken(Long userId) {
        synchronized (refreshLocks[Math.floorMod(userId.hashCode(), refreshLocks.length)]) {
            return resolveAccessToken(userId);
        }
    }

    private String resolveAccessToken(Long userId) {
        SpotifyToken token = repository.findById(userId)
                .orElseThrow(SpotifyReauthorizationRequiredException::new);

        if (!token.isExpired()) {
            return token.getAccessToken();
        }

        if (token.getRefreshToken() == null || token.getRefreshToken().isBlank()) {
            if (repository.deleteIfCurrent(userId, token.getAccessToken()) == 0) {
                return currentAccessToken(userId);
            }
            throw new SpotifyReauthorizationRequiredException();
        }

        try {
            return refresh(token);
        } catch (RestClientResponseException e) {
            if (isInvalidGrant(e)) {
                if (repository.deleteIfCurrent(userId, token.getAccessToken()) == 0) {
                    return currentAccessToken(userId);
                }
                throw new SpotifyReauthorizationRequiredException();
            }
            // 통신/서버/앱 설정 오류에는 토큰을 삭제하지 않는다.
            throw e;
        }
    }

    private boolean isInvalidGrant(RestClientResponseException error) {
        if (error.getStatusCode().value() != 400) return false;
        try {
            var body = objectMapper.readTree(error.getResponseBodyAsString());
            return body != null && "invalid_grant".equals(body.path("error").asText());
        } catch (JsonProcessingException e) {
            return false;
        }
    }

    private record TokenResponse(@JsonProperty("access_token") String accessToken,
                                 @JsonProperty("expires_in") Long expiresIn,
                                 @JsonProperty("refresh_token") String refreshToken) {}

    private String refresh(SpotifyToken token) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", token.getRefreshToken());

        String basic = Base64.getEncoder().encodeToString((clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        TokenResponse response = restClient.post()
                .uri(TOKEN_URL)
                .header("Authorization", "Basic " + basic)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(TokenResponse.class);

        if (response == null || response.accessToken() == null || response.accessToken().isBlank()
                || response.expiresIn() == null || response.expiresIn() <= 0) {
            throw new RestClientException("Invalid Spotify token response");
        }

        String refresh = response.refreshToken() == null ? token.getRefreshToken() : response.refreshToken();
        int updated = repository.replaceIfCurrent(token.getUserId(), token.getAccessToken(),
                response.accessToken(), refresh, Instant.now().plusSeconds(response.expiresIn()));
        return updated == 1 ? response.accessToken() : currentAccessToken(token.getUserId());
    }

    private String currentAccessToken(Long userId) {
        return repository.findById(userId).filter(token -> !token.isExpired())
                .map(SpotifyToken::getAccessToken).orElseThrow(SpotifyReauthorizationRequiredException::new);
    }
}
