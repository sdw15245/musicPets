package com.example.demo.spotify;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

/** SpotifyToken CRUD. PK가 userId라 findById/save만으로 충분. */
public interface SpotifyTokenRepository extends JpaRepository<SpotifyToken, Long> {
    // 재로그인으로 바뀐 토큰을 오래된 갱신 응답이 덮거나 삭제하지 않는다.
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("update SpotifyToken t set t.accessToken = :access, t.refreshToken = :refresh, t.expiresAt = :expires "
            + "where t.userId = :userId and t.accessToken = :expected")
    int replaceIfCurrent(@Param("userId") Long userId, @Param("expected") String expected,
                         @Param("access") String access, @Param("refresh") String refresh,
                         @Param("expires") Instant expires);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("delete from SpotifyToken t where t.userId = :userId and t.accessToken = :expected")
    int deleteIfCurrent(@Param("userId") Long userId, @Param("expected") String expected);
}
