package com.example.demo.notification;

import com.example.demo.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "activity_notifications",
       uniqueConstraints = @UniqueConstraint(columnNames = {"recipient_id", "actor_id", "kind", "source_id"}),
       indexes = {@Index(name = "idx_notification_recipient_id", columnList = "recipient_id,id"),
                  @Index(name = "idx_notification_unread", columnList = "recipient_id,read_at"),
                  @Index(name = "idx_notification_post", columnList = "post_id"),
                  @Index(name = "idx_notification_comment", columnList = "comment_id")})
public class ActivityNotification {
    public enum Kind { LIKE, COMMENT, REPLY }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "recipient_id") private User recipient;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "actor_id") private User actor;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Kind kind;
    @Column(name = "source_id", nullable = false) private Long sourceId;
    @Column(name = "post_id", nullable = false) private Long postId;
    @Column(name = "comment_id") private Long commentId;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    @Column(name = "read_at") private Instant readAt;
    protected ActivityNotification() {}
    public ActivityNotification(User recipient, User actor, Kind kind, Long postId, Long commentId) {
        this.recipient = recipient; this.actor = actor; this.kind = kind; this.postId = postId; this.commentId = commentId;
        sourceId = commentId == null ? postId : commentId;
    }
    public Long getId() { return id; }
    public User getActor() { return actor; }
    public Kind getKind() { return kind; }
    public Long getPostId() { return postId; }
    public Long getCommentId() { return commentId; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isRead() { return readAt != null; }
    public void markRead() { if (readAt == null) readAt = Instant.now(); }
}
