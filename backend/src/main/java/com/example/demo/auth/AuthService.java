package com.example.demo.auth;

import com.example.demo.jwt.JwtTokenProvider;
import io.jsonwebtoken.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** refresh 토큰 검증 후 새 access 토큰 발급, 로그아웃 시 DB의 refresh 토큰 삭제. */
@Service
public class AuthService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider tokenProvider;

    public AuthService(RefreshTokenRepository refreshTokenRepository, JwtTokenProvider tokenProvider) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenProvider = tokenProvider;
    }

    @Transactional(readOnly = true)
    public String refresh(String refreshToken) {
        try {
            if (!tokenProvider.validate(refreshToken) || !tokenProvider.isRefreshToken(refreshToken)) {
                throw new InvalidRefreshTokenException();
            }
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidRefreshTokenException();
        }

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
}
