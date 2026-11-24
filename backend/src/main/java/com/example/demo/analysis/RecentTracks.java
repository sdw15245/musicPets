package com.example.demo.analysis;

import com.example.demo.spotify.SpotifyService.TopTrack;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 분석 직후의 상세 단계(AI 해설, 추천 아티스트)가 쓸 원본 트랙을 사용자별로 잠시 보관한다.
 * 개인 청취 기록이라 DB에 저장하지 않고 이 서버 메모리에만 둔다.
 * 그래서 상세 단계 요청은 분석한 서버로 와야 하고, 재시작하면 사라진다.
 */
final class RecentTracks {
    private record Entry(String analysisId, Instant expiresAt, List<TopTrack> tracks) {}

    private final Map<Long, Entry> entries = new LinkedHashMap<>();
    private final Duration ttl;
    private final int maxUsers;
    private final Clock clock;

    RecentTracks(Duration ttl, int maxUsers, Clock clock) {
        this.ttl = ttl;
        this.maxUsers = maxUsers;
        this.clock = clock;
    }

    synchronized void put(Long userId, String analysisId, Instant analyzedAt, List<TopTrack> tracks) {
        // 다시 분석한 사용자를 가장 최근 순서로 옮겨, 오래된 사용자부터 비운다.
        entries.remove(userId);
        entries.put(userId, new Entry(analysisId, analyzedAt.plus(ttl), List.copyOf(tracks)));
        while (entries.size() > maxUsers) entries.remove(entries.keySet().iterator().next());
    }

    /** 해당 분석의 트랙이 아직 남아 있을 때만 돌려준다. 같은 사용자의 다른 분석 트랙은 주지 않는다. */
    synchronized Optional<List<TopTrack>> find(Long userId, String analysisId) {
        Instant now = clock.instant();
        entries.values().removeIf(entry -> entry.expiresAt().isBefore(now));
        Entry entry = entries.get(userId);
        return entry != null && entry.analysisId().equals(analysisId) ? Optional.of(entry.tracks()) : Optional.empty();
    }
}
