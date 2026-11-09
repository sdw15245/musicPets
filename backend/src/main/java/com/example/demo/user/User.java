package com.example.demo.user;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import org.hibernate.annotations.DynamicUpdate;

/** 우리 앱 사용자 본질 정보 (내부 PK + Spotify ID + 이메일/표시명). */
@Entity
@DynamicUpdate
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String spotifyId;

    private String email;

    private String displayName;

    @Column(length = 30)
    private String nickname;
    private String analyzedPet;

    @ElementCollection
    @CollectionTable(name = "user_characters", joinColumns = @JoinColumn(name = "user_id"),
            uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "character_slug"}))
    @Column(name = "character_slug", nullable = false)
    private Set<String> unlockedCharacters = new HashSet<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected User() {}

    public User(String spotifyId, String email, String displayName) {
        this.spotifyId = spotifyId;
        this.email = email;
        this.displayName = displayName;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getSpotifyId() { return spotifyId; }
    public String getEmail() { return email; }
    public String getDisplayName() { return displayName; }
    public String getNickname() { return nickname; }
    public String getAnalyzedPet() { return analyzedPet; }
    public Set<String> getUnlockedCharacters() { return Set.copyOf(unlockedCharacters); }

    public void editProfile(String nickname) {
        this.nickname = nickname;
    }

    public void recordAnalysis(String petSlug) {
        analyzedPet = petSlug;
        if (petSlug != null) unlockedCharacters.add(petSlug);
    }

    public void updateProfile(String email, String displayName) {
        this.email = email;
        this.displayName = displayName;
    }
}
