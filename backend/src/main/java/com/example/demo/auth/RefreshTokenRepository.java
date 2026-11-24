package com.example.demo.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** RefreshToken 조회/삭제. 토큰은 항상 RefreshToken.hash로 바꾼 값으로 찾는다. */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    void deleteByUserId(Long userId);
    void deleteByTokenHash(String tokenHash);
}
