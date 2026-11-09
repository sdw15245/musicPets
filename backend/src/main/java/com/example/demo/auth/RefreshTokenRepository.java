package com.example.demo.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** RefreshToken 조회/삭제. token 단건 조회, userId로 일괄 삭제(로그아웃). */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    void deleteByUserId(Long userId);
    void deleteByToken(String token);
}
