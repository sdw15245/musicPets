package com.example.demo.analysis;

import com.example.demo.spotify.SpotifyService.TopTrack;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RecentTracksTest {
    private static final Instant NOW = Instant.parse("2026-11-25T00:00:00Z");
    private static final List<TopTrack> TRACKS = List.of(new TopTrack("Song", "Artist"));

    private RecentTracks at(Instant now) {
        return new RecentTracks(Duration.ofMinutes(10), 2, Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void returnsTracksOnlyForTheSameAnalysisBeforeTheyExpire() {
        var fresh = at(NOW.plus(Duration.ofMinutes(9)));
        fresh.put(1L, "run-1", NOW, TRACKS);
        assertThat(fresh.find(1L, "run-1")).contains(TRACKS);
        assertThat(fresh.find(1L, "other-run")).isEmpty();
        assertThat(fresh.find(2L, "run-1")).isEmpty();

        var expired = at(NOW.plus(Duration.ofMinutes(11)));
        expired.put(1L, "run-1", NOW, TRACKS);
        assertThat(expired.find(1L, "run-1")).isEmpty();
    }

    @Test
    void reanalysisMovesTheUserToTheNewestSlot() {
        var tracks = at(NOW);
        tracks.put(1L, "a", NOW, TRACKS);
        tracks.put(2L, "b", NOW, TRACKS);
        tracks.put(1L, "a2", NOW, TRACKS);
        tracks.put(3L, "c", NOW, TRACKS);

        assertThat(tracks.find(2L, "b")).as("oldest user is evicted first").isEmpty();
        assertThat(tracks.find(1L, "a2")).isPresent();
        assertThat(tracks.find(1L, "a")).isEmpty();
        assertThat(tracks.find(3L, "c")).isPresent();
    }
}
