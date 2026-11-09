package com.example.demo.community;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Set;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {
    boolean existsByPostIdAndUserId(Long postId, Long userId);
    long countByPostId(Long postId);
    void deleteByPostIdAndUserId(Long postId, Long userId);

    @Query("select l.post.id from PostLike l where l.user.id = :userId and l.post.id in :postIds")
    Set<Long> findLikedPostIds(@Param("userId") Long userId, @Param("postIds") List<Long> postIds);

    @Modifying
    @Query("delete from PostLike l where l.post.id = :postId")
    void deleteByPostId(@Param("postId") Long postId);
}
