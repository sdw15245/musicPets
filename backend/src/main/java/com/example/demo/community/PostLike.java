package com.example.demo.community;

import com.example.demo.user.User;
import jakarta.persistence.*;

@Entity
@Table(name = "post_likes", uniqueConstraints = @UniqueConstraint(name = "uk_post_like", columnNames = {"post_id", "user_id"}),
        indexes = @Index(name = "idx_post_likes_user", columnList = "user_id,post_id"))
public class PostLike {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false, updatable = false)
    private Post post;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    protected PostLike() {}
    public PostLike(Post post, User user) { this.post = post; this.user = user; }
}
