package com.example.demo.notification;

import com.example.demo.community.Post;
import com.example.demo.community.Comment;
import com.example.demo.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import com.example.demo.community.PostRepository;
import com.example.demo.community.CommentRepository;
import static com.example.demo.notification.ActivityNotification.Kind.*;

@Service
@Transactional
public class NotificationService {
    private final ActivityNotificationRepository notifications;
    private final PostRepository posts;
    private final CommentRepository comments;
    public NotificationService(ActivityNotificationRepository notifications, PostRepository posts, CommentRepository comments) {
        this.notifications = notifications; this.posts = posts; this.comments = comments;
    }
    public record NotificationView(String id, String actor, String avatarSlug, ActivityNotification.Kind kind,
                                   String postId, String commentId, Instant createdAt, boolean read,
                                   String postPreview, String commentPreview) {}
    public record NotificationPage(List<NotificationView> items, int page, boolean hasMore, long unreadCount) {}

    // 호출자는 게시글을 잠근 같은 트랜잭션에서 실제 생성된 행동에 대해서만 알림을 만든다.
    public void liked(Post post, User actor) { create(post.getAuthor(), actor, LIKE, post.getId(), null); }
    public void commented(Comment comment) {
        var parent = comment.getParent();
        var author = comment.getAuthor();
        // 댓글 작성자가 글 작성자이기도 하면 답글 알림 하나만 전달한다.
        if (parent == null || !parent.getAuthor().getId().equals(comment.getPost().getAuthor().getId()))
            create(comment.getPost().getAuthor(), author, COMMENT, comment.getPost().getId(), comment.getId());
        if (parent != null) create(parent.getAuthor(), author, REPLY, comment.getPost().getId(), comment.getId());
    }
    private void create(User recipient, User actor, ActivityNotification.Kind kind, Long postId, Long commentId) {
        if (!recipient.getId().equals(actor.getId()))
            notifications.save(new ActivityNotification(recipient, actor, kind, postId, commentId));
    }
    public void unlike(Long postId, Long actorId) { notifications.deleteByPostIdAndActorIdAndKind(postId, actorId, LIKE); }
    public void deleteComment(Long commentId) { notifications.deleteByCommentId(commentId); }
    public void deletePost(Long postId) { notifications.deleteByPostId(postId); }

    @Transactional(readOnly = true)
    public NotificationPage list(Long userId, int page) {
        if (page < 0 || page > 10000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var rows = notifications.findByRecipientIdOrderByIdDesc(userId, PageRequest.of(page, 20));
        var postIds = rows.stream().map(ActivityNotification::getPostId).distinct().toList();
        var commentIds = rows.stream().map(ActivityNotification::getCommentId).filter(Objects::nonNull).distinct().toList();
        // Fetch only preview columns in two batches instead of loading each notification's entities.
        Map<Long, String> postPreviews = postIds.isEmpty() ? Map.of() : posts.notificationPreviews(postIds).stream()
                .collect(Collectors.toMap(PostRepository.NotificationPostPreview::getId, item -> excerpt(item.getTrackName() + " · " + item.getTrackArtist())));
        Map<Long, String> commentPreviews = commentIds.isEmpty() ? Map.of() : comments.notificationPreviews(commentIds).stream()
                .collect(Collectors.toMap(CommentRepository.NotificationCommentPreview::getId, item -> excerpt(item.getBody())));
        return new NotificationPage(rows.stream().map(item -> view(item, postPreviews, commentPreviews)).toList(), page, rows.hasNext(), unreadCount(userId));
    }
    @Transactional(readOnly = true)
    public long unreadCount(Long userId) { return notifications.countByRecipientIdAndReadAtIsNull(userId); }
    public void read(Long userId, Long id) {
        notifications.findByIdAndRecipientId(id, userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)).markRead();
    }
    public void readAll(Long userId) { notifications.markAllRead(userId, Instant.now()); }
    private NotificationView view(ActivityNotification notification, Map<Long, String> postPreviews, Map<Long, String> commentPreviews) {
        User actor = notification.getActor();
        String name = actor.getNickname() != null ? actor.getNickname() : actor.getDisplayName();
        if (name == null || name.isBlank()) name = actor.getSpotifyId();
        return new NotificationView(notification.getId().toString(), name, actor.getAnalyzedPet(), notification.getKind(),
            notification.getPostId().toString(), notification.getCommentId() == null ? null : notification.getCommentId().toString(),
            notification.getCreatedAt(), notification.isRead(), postPreviews.get(notification.getPostId()),
            notification.getCommentId() == null ? null : commentPreviews.get(notification.getCommentId()));
    }
    private static String excerpt(String value) {
        String compact = value.replaceAll("\\s+", " ").strip();
        return compact.codePointCount(0, compact.length()) <= 100 ? compact : compact.substring(0, compact.offsetByCodePoints(0, 100)) + "…";
    }
}
