package com.example.demo.notification;

import com.example.demo.community.CommunityEvent;
import com.example.demo.community.CommunityEvent.CommentCreated;
import com.example.demo.community.CommunityEvent.CommentDeleted;
import com.example.demo.community.CommunityEvent.PostDeleted;
import com.example.demo.community.CommunityEvent.PostLiked;
import com.example.demo.community.CommunityEvent.PostUnliked;
import com.example.demo.community.Post;
import com.example.demo.community.Comment;
import com.example.demo.user.User;
import org.springframework.context.event.EventListener;
import com.example.demo.paging.Paging;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;
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

    /**
     * 커뮤니티 활동을 알림으로 반영한다. 활동을 만든 트랜잭션(게시글 잠금 포함) 안에서 동기로 실행되므로,
     * 알림 저장이 실패하면 활동도 롤백된다. 실제로 생긴 활동만 발행된다(중복 공감 등은 발행되지 않음).
     */
    @EventListener
    public void on(CommunityEvent event) {
        switch (event) {
            case PostLiked(Post post, User actor) -> create(post.getAuthor(), actor, LIKE, post.getId(), null);
            case PostUnliked(Long postId, Long actorId) -> notifications.deleteByPostIdAndActorIdAndKind(postId, actorId, LIKE);
            case CommentCreated(Comment comment) -> commented(comment);
            case CommentDeleted(Long commentId) -> notifications.deleteByCommentId(commentId);
            case PostDeleted(Long postId) -> notifications.deleteByPostId(postId);
        }
    }

    private void commented(Comment comment) {
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

    @Transactional(readOnly = true)
    public NotificationPage list(Long userId, int page) {
        var rows = notifications.findByRecipientIdOrderByIdDesc(userId, Paging.of(page, Sort.unsorted()));
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
        notifications.findByIdAndRecipientId(id, userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND)).markRead();
    }
    public void readAll(Long userId) { notifications.markAllRead(userId, Instant.now()); }
    private NotificationView view(ActivityNotification notification, Map<Long, String> postPreviews, Map<Long, String> commentPreviews) {
        User actor = notification.getActor();
        String name = actor.publicName();
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
