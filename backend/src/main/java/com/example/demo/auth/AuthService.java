package com.example.demo.auth;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.jwt.JwtTokenProvider.TokenType;
import com.example.demo.spotify.SpotifyTokenService;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/** 로그인(세션 시작), refresh 토큰으로 access 토큰 재발급, 로그아웃(세션 종료). */
@Service
public class AuthService {

    /**
     * Spotify 로그인 결과.
     * @param tokens Spotify가 승인 정보를 주지 않았으면 null. 이때 기존 Spotify 토큰을 그대로 둔다.
     */
    public record SpotifyLogin(String spotifyId, String email, String displayName, SpotifyTokens tokens) {}

    /** @param refreshToken Spotify가 새로 주지 않았으면 null. 이때 기존 refresh 토큰을 유지한다. */
    public record SpotifyTokens(String accessToken, String refreshToken, Instant expiresAt) {}

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider tokenProvider;
    private final UserRepository users;
    private final SpotifyTokenService spotifyTokens;

    public AuthService(RefreshTokenRepository refreshTokenRepository, JwtTokenProvider tokenProvider,
                       UserRepository users, SpotifyTokenService spotifyTokens) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenProvider = tokenProvider;
        this.users = users;
        this.spotifyTokens = spotifyTokens;
    }

    /** 사용자와 Spotify 토큰을 저장하고 우리 refresh 토큰을 새로 발급한다. */
    @Transactional
    public String login(SpotifyLogin login) {
        User user = users.findBySpotifyId(login.spotifyId())
                .map(existing -> {
                    existing.updateProfile(login.email(), login.displayName());
                    return existing;
                })
                .orElseGet(() -> users.save(new User(login.spotifyId(), login.email(), login.displayName())));
        SpotifyTokens tokens = login.tokens();
        if (tokens != null) {
            spotifyTokens.store(user.getId(), tokens.accessToken(), tokens.refreshToken(), tokens.expiresAt());
        }
        return startSession(user.getId());
    }

    @Transactional(readOnly = true)
    public String refresh(String refreshToken) {
        tokenProvider.verify(refreshToken, TokenType.REFRESH).orElseThrow(InvalidRefreshTokenException::new);
        RefreshToken stored = refreshTokenRepository.findByToken(refreshToken)
                .orElseThrow(InvalidRefreshTokenException::new);
        if (stored.isExpired()) {
            throw new InvalidRefreshTokenException();
        }
        return tokenProvider.createAccessToken(stored.getUserId());
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) refreshTokenRepository.deleteByToken(refreshToken);
    }

    /** 이 사용자의 기존 refresh 토큰을 모두 지우고 새로 발급한다. 다른 기기의 로그인은 다음 갱신 때 끝난다. */
    private String startSession(Long userId) {
        String token = tokenProvider.createRefreshToken(userId);
        refreshTokenRepository.deleteByUserId(userId);
        refreshTokenRepository.save(new RefreshToken(token, userId,
                Instant.now().plusMillis(tokenProvider.getRefreshExpirationMs())));
        return token;
    }
}
