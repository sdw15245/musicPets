package com.example.demo.community;

import com.example.demo.paging.Paging;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class CommentService {
    private final CommentRepository comments;
    private final PostRepository posts;
    private final UserRepository users;
    private final ApplicationEventPublisher events;

    public CommentService(CommentRepository comments, PostRepository posts, UserRepository users, ApplicationEventPublisher events) {
        this.comments = comments; this.posts = posts; this.users = users;
        this.events = events;
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
            if (target.isDeleted()) throw new ApiException(ErrorCode.NOT_FOUND);
            Long rootId = target.getParent() == null ? target.getId() : target.getParent().getId();
            // Root threads are ordered newest first; reply ids do not affect their position.
            page = Math.toIntExact(comments.countByPostIdAndParentIsNullAndIdGreaterThan(postId, rootId) / Paging.SIZE);
        }
        return list(viewer, postId, page);
    }

    @Transactional(readOnly = true)
    public CommentPage list(Long viewer, Long postId, int page) {
        var newestFirst = Paging.of(page, Sort.by(Sort.Direction.DESC, "id"));
        if (!posts.existsById(postId)) throw new ApiException(ErrorCode.NOT_FOUND);
        var roots = comments.findByPostIdAndParentIsNull(postId, newestFirst);
        var items = new ArrayList<>(roots.getContent());
        if (!items.isEmpty()) {
            items.addAll(comments.findByPostIdAndParentIdInOrderByIdAsc(postId, roots.stream().map(Comment::getId).toList()));
        }
        return new CommentPage(items.stream().map(comment -> view(comment, viewer)).toList(), page, roots.hasNext());
    }

    public CommentView create(Long userId, Long postId, CreateComment request) {
        String body = validateBody(request.body());
        Post post = lockPost(postId);
        User author = users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        Comment parent = request.parentId() == null ? null : requireComment(postId, request.parentId());
        if (parent != null && (parent.getParent() != null || parent.isDeleted())) {
            throw new ApiException(ErrorCode.INVALID_REQUEST, "삭제되지 않은 원댓글에만 답글을 달 수 있어요.");
        }
        Comment comment = comments.save(new Comment(post, author, parent, body));
        events.publishEvent(new CommunityEvent.CommentCreated(comment));
        return view(comment, userId);
    }

    public CommentView update(Long userId, Long postId, Long id, EditComment request) {
        String body = validateBody(request.body());
        lockPost(postId);
        Comment comment = requireComment(postId, id);
        requireOwner(comment, userId);
        if (comment.isDeleted()) throw new ApiException(ErrorCode.NOT_FOUND);
        comment.edit(body);
        return view(comment, userId);
    }

    public void delete(Long userId, Long postId, Long id) {
        lockPost(postId);
        Comment comment = requireComment(postId, id);
        requireOwner(comment, userId);
        // 내용만 비워 답글의 연결과 대화 순서를 보존한다.
        comment.delete();
        events.publishEvent(new CommunityEvent.CommentDeleted(id));
    }

    private Post lockPost(Long postId) {
        // 게시글 삭제와 댓글 변경이 동시에 실행되지 않도록 같은 게시글 잠금을 사용한다.
        return posts.findForUpdate(postId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }
    private Comment requireComment(Long postId, Long id) {
        return comments.findById(id).filter(comment -> comment.getPost().getId().equals(postId))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }
    private void requireOwner(Comment comment, Long userId) {
        if (!comment.getAuthor().getId().equals(userId)) throw new ApiException(ErrorCode.FORBIDDEN, "본인 댓글만 변경할 수 있어요.");
    }
    private String validateBody(String input) {
        String body = input == null ? "" : input.strip();
        if (body.isBlank() || body.length() > 500) throw new ApiException(ErrorCode.INVALID_REQUEST, "댓글은 1~500자로 입력해주세요.");
        return body;
    }
    private CommentView view(Comment comment, Long viewer) {
        User author = comment.getAuthor();
        String name = author.publicName();
        return new CommentView(comment.getId().toString(), comment.getPost().getId().toString(),
                comment.getParent() == null ? null : comment.getParent().getId().toString(),
                comment.isDeleted() ? "" : name, comment.isDeleted() ? null : author.getAnalyzedPet(), comment.getBody(), comment.getCreatedAt(),
                comment.isDeleted(), !comment.isDeleted() && author.getId().equals(viewer));
    }
}
