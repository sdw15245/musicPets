package com.example.demo.notification;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import java.time.Instant;
import java.util.Optional;

public interface ActivityNotificationRepository extends JpaRepository<ActivityNotification, Long> {
    @EntityGraph(attributePaths = "actor")
    Slice<ActivityNotification> findByRecipientIdOrderByIdDesc(Long recipientId, Pageable pageable);
    Optional<ActivityNotification> findByIdAndRecipientId(Long id, Long recipientId);
    long countByRecipientIdAndReadAtIsNull(Long recipientId);
    void deleteByPostId(Long postId);
    void deleteByCommentId(Long commentId);
    void deleteByPostIdAndActorIdAndKind(Long postId, Long actorId, ActivityNotification.Kind kind);
    @Modifying
    @Query("update ActivityNotification n set n.readAt = :now where n.recipient.id = :userId and n.readAt is null")
    void markAllRead(Long userId, Instant now);
}
