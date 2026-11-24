package com.example.demo.cache;

/**
 * 공개 음악 메타데이터 캐시의 종류와 보관 기간 구분.
 * key는 Redis 키에 그대로 들어간다. 바꾸면 기존 캐시를 읽지 못하고 새로 채운다.
 */
public enum CacheCategory {
    TRACK_TAGS("track-tags", true),
    ARTIST_TAGS("artist-tags", true),
    LISTENERS("listeners", false),
    SIMILAR_ARTISTS("similar-artists", false);

    private final String key;
    private final boolean tags;

    CacheCategory(String key, boolean tags) {
        this.key = key;
        this.tags = tags;
    }

    String key() { return key; }

    /** 태그는 잘 바뀌지 않아 더 오래 보관한다(app.music-cache.tags-ttl). 나머지는 metadata-ttl. */
    boolean tags() { return tags; }
}
