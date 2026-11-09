package com.example.demo.genre;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * LLM이 분류한 태그 결과 캐시. (사전에 있는 태그는 여기 저장 안 함)
 * mainGenre가 null이면 "LLM이 장르 아니라고 판단" = 다시 안 부름.
 */
@Entity
@Table(name = "tag_normalizations")
public class TagNormalization {

    @Id
    private String tag;

    private String mainGenre;

    @Column(nullable = false, updatable = false)
    private Instant classifiedAt;

    protected TagNormalization() {}

    public TagNormalization(String tag, String mainGenre) {
        this.tag = tag;
        this.mainGenre = mainGenre;
        this.classifiedAt = Instant.now();
    }

    public String getTag() { return tag; }
    public String getMainGenre() { return mainGenre; }
}
