package com.example.demo.community;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    long countByPostIdAndParentIsNullAndIdGreaterThan(Long postId, Long id);

    interface NotificationCommentPreview { Long getId(); String getBody(); }
    @Query("select c.id as id, c.body as body from Comment c where c.id in :ids and c.deleted = false")
    List<NotificationCommentPreview> notificationPreviews(@Param("ids") List<Long> ids);
    interface PostCommentCount {
        Long getPostId();
        long getCommentCount();
    }

    @Query("select c.post.id as postId, count(c) as commentCount from Comment c where c.post.id in :postIds and c.deleted = false group by c.post.id")
    List<PostCommentCount> countForPosts(@Param("postIds") List<Long> postIds);

    long countByPostIdAndDeletedFalse(Long postId);

    @EntityGraph(attributePaths = "author")
    Slice<Comment> findByPostIdAndParentIsNull(Long postId, Pageable pageable);

    @EntityGraph(attributePaths = "author")
    List<Comment> findByPostIdAndParentIdInOrderByIdAsc(Long postId, List<Long> parentIds);

    @Modifying
    @Query("delete from Comment c where c.post.id = :postId and c.parent is not null")
    void deleteRepliesByPostId(@Param("postId") Long postId);

    @Modifying
    @Query("delete from Comment c where c.post.id = :postId")
    void deleteByPostId(@Param("postId") Long postId);
}
