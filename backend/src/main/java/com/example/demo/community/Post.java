package com.example.demo.community;

import com.example.demo.spotify.SpotifyService.TrackHit;
import com.example.demo.user.User;
import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.Formula;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts", indexes = @Index(name = "idx_posts_author_id", columnList = "author_id,id"))
public class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false, updatable = false)
    private User author;
    @Column(nullable = false, length = 280)
    private String caption;
    @Column(nullable = false, length = 64)
    private String trackUri;
    @Column(nullable = false, length = 1000)
    private String trackName;
    @Column(nullable = false, length = 2000)
    private String trackArtist;
    @Column(nullable = false, length = 2000)
    private String trackImageUrl;
    @ElementCollection
    @CollectionTable(name = "post_tags", joinColumns = @JoinColumn(name = "post_id"))
    @OrderColumn(name = "tag_order")
    @Column(name = "tag", nullable = false, length = 30)
    @BatchSize(size = 20)
    private List<String> tags = new ArrayList<>();
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    @Column(nullable = false)
    private Instant updatedAt;
    // Derived on read: no separate counter that can drift from the actual likes.
    @Formula("(select count(*) from post_likes pl where pl.post_id = id)")
    private long likes;

    protected Post() {}
    public Post(User author) { this.author = author; this.createdAt = Instant.now(); }
    public Long getId() { return id; }
    public User getAuthor() { return author; }
    public String getCaption() { return caption; }
    public List<String> getTags() { return List.copyOf(tags); }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getLikes() { return likes; }
    public TrackHit getTrack() { return new TrackHit(trackUri, trackName, trackArtist, trackImageUrl); }
    public void edit(TrackHit track, String caption, List<String> tags) {
        this.trackUri = track.uri(); this.trackName = track.name();
        this.trackArtist = track.artist(); this.trackImageUrl = track.imageUrl();
        this.caption = caption;
        this.tags.clear(); this.tags.addAll(tags);
        this.updatedAt = Instant.now();
    }
}
