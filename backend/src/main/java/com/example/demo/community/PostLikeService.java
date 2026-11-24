package com.example.demo.community;

import com.example.demo.user.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;

@Service
public class PostLikeService {
    private final PostRepository posts;
    private final PostLikeRepository likes;
    private final UserRepository users;
    private final ApplicationEventPublisher events;

    public PostLikeService(PostRepository posts, PostLikeRepository likes, UserRepository users, ApplicationEventPublisher events) {
        this.posts = posts; this.likes = likes; this.users = users;
        this.events = events;
    }

    public record LikeView(long likes, boolean liked) {}

    @Transactional
    public LikeView setLiked(Long userId, Long postId, boolean liked) {
        if (userId == null) throw new ApiException(ErrorCode.UNAUTHORIZED);
        // Use the same lock as post deletion; repeated/concurrent requests cannot double count.
        Post post = posts.findForUpdate(postId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        var user = users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        boolean exists = likes.existsByPostIdAndUserId(postId, userId);
        if (liked && !exists) {
            likes.save(new PostLike(post, user));
            post.addLike();
            events.publishEvent(new CommunityEvent.PostLiked(post, user));
        }
        if (!liked && exists) {
            likes.deleteByPostIdAndUserId(postId, userId);
            post.removeLike();
            events.publishEvent(new CommunityEvent.PostUnliked(postId, userId));
        }
        return new LikeView(post.getLikes(), liked);
    }
}
