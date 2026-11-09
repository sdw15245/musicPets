package com.example.demo.community;

import com.example.demo.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PostLikeService {
    private final PostRepository posts;
    private final PostLikeRepository likes;
    private final UserRepository users;
    private final com.example.demo.notification.NotificationService notifications;

    public PostLikeService(PostRepository posts, PostLikeRepository likes, UserRepository users, com.example.demo.notification.NotificationService notifications) {
        this.posts = posts; this.likes = likes; this.users = users;
        this.notifications = notifications;
    }

    public record LikeView(long likes, boolean liked) {}

    @Transactional
    public LikeView setLiked(Long userId, Long postId, boolean liked) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        // Use the same lock as post deletion; repeated/concurrent requests cannot double count.
        Post post = posts.findForUpdate(postId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        boolean exists = likes.existsByPostIdAndUserId(postId, userId);
        if (liked && !exists) {
            likes.save(new PostLike(post, user));
            notifications.liked(post, user);
        }
        if (!liked && exists) {
            likes.deleteByPostIdAndUserId(postId, userId);
            notifications.unlike(postId, userId);
        }
        return new LikeView(likes.countByPostId(postId), liked);
    }
}
