package com.example.demo.community;

import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class CommentService {
    private final CommentRepository comments;
    private final PostRepository posts;
    private final UserRepository users;
    private final com.example.demo.notification.NotificationService notifications;

    public CommentService(CommentRepository comments, PostRepository posts, UserRepository users, com.example.demo.notification.NotificationService notifications) {
        this.comments = comments; this.posts = posts; this.users = users;
        this.notifications = notifications;
    }

    public record CreateComment(String body, Long parentId) {}
    public record EditComment(String body) {}
    public record CommentView(String id, String postId, String parentId, String author, String avatarSlug,
                              String body, Instant createdAt, boolean deleted, boolean own) {}
    public record CommentPage(List<CommentView> items, int page, boolean hasMore) {}

    @Transactional(readOnly = true)
    public CommentPage list(Long viewer, Long postId, int page, Long focus) {
        if (focus != null && page == 0) {
            Comment target = requireComment(postId, focus);
            if (target.isDeleted()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
            Long rootId = target.getParent() == null ? target.getId() : target.getParent().getId();
            // Root threads are ordered newest first; reply ids do not affect their position.
            page = Math.toIntExact(comments.countByPostIdAndParentIsNullAndIdGreaterThan(postId, rootId) / 20);
        }
        return list(viewer, postId, page);
    }

    @Transactional(readOnly = true)
    public CommentPage list(Long viewer, Long postId, int page) {
        if (page < 0 || page > 10000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (!posts.existsById(postId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var roots = comments.findByPostIdAndParentIsNull(postId, PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "id")));
        var items = new ArrayList<>(roots.getContent());
        if (!items.isEmpty()) {
            items.addAll(comments.findByPostIdAndParentIdInOrderByIdAsc(postId, roots.stream().map(Comment::getId).toList()));
        }
        return new CommentPage(items.stream().map(comment -> view(comment, viewer)).toList(), page, roots.hasNext());
    }

    public CommentView create(Long userId, Long postId, CreateComment request) {
        String body = validateBody(request.body());
        Post post = lockPost(postId);
        User author = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        Comment parent = request.parentId() == null ? null : requireComment(postId, request.parentId());
        if (parent != null && (parent.getParent() != null || parent.isDeleted())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "삭제되지 않은 원댓글에만 답글을 달 수 있어요.");
        }
        Comment comment = comments.save(new Comment(post, author, parent, body));
        notifications.commented(comment);
        return view(comment, userId);
    }

    public CommentView update(Long userId, Long postId, Long id, EditComment request) {
        String body = validateBody(request.body());
        lockPost(postId);
        Comment comment = requireComment(postId, id);
        requireOwner(comment, userId);
        if (comment.isDeleted()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        comment.edit(body);
        return view(comment, userId);
    }

    public void delete(Long userId, Long postId, Long id) {
        lockPost(postId);
        Comment comment = requireComment(postId, id);
        requireOwner(comment, userId);
        // 내용만 비워 답글의 연결과 대화 순서를 보존한다.
        comment.delete();
        notifications.deleteComment(id);
    }

    private Post lockPost(Long postId) {
        // 게시글 삭제와 댓글 변경이 동시에 실행되지 않도록 같은 게시글 잠금을 사용한다.
        return posts.findForUpdate(postId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private Comment requireComment(Long postId, Long id) {
        return comments.findById(id).filter(comment -> comment.getPost().getId().equals(postId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private void requireOwner(Comment comment, Long userId) {
        if (!comment.getAuthor().getId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 댓글만 변경할 수 있어요.");
    }
    private String validateBody(String input) {
        String body = input == null ? "" : input.strip();
        if (body.isBlank() || body.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글은 1~500자로 입력해주세요.");
        return body;
    }
    private CommentView view(Comment comment, Long viewer) {
        User author = comment.getAuthor();
        String name = author.getNickname() != null ? author.getNickname() : author.getDisplayName();
        if (name == null || name.isBlank()) name = author.getSpotifyId();
        return new CommentView(comment.getId().toString(), comment.getPost().getId().toString(),
                comment.getParent() == null ? null : comment.getParent().getId().toString(),
                comment.isDeleted() ? "" : name, comment.isDeleted() ? null : author.getAnalyzedPet(), comment.getBody(), comment.getCreatedAt(),
                comment.isDeleted(), !comment.isDeleted() && author.getId().equals(viewer));
    }
}
