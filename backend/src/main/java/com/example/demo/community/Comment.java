package com.example.demo.community;

import com.example.demo.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "comments", indexes = @Index(name = "idx_comments_post_parent_id", columnList = "post_id,parent_id,id"))
public class Comment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false, updatable = false)
    private Post post;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false, updatable = false)
    private User author;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", updatable = false)
    private Comment parent;
    @Column(nullable = false, length = 500)
    private String body;
    @Column(nullable = false)
    private boolean deleted;
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected Comment() {}
    public Comment(Post post, User author, Comment parent, String body) {
        this.post = post; this.author = author; this.parent = parent;
        this.body = body; this.createdAt = Instant.now();
    }
    public Long getId() { return id; }
    public Post getPost() { return post; }
    public User getAuthor() { return author; }
    public Comment getParent() { return parent; }
    public String getBody() { return body; }
    public boolean isDeleted() { return deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public void edit(String body) { this.body = body; }
    public void delete() { this.body = ""; this.deleted = true; }
}
