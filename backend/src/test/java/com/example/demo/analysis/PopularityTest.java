package com.example.demo.analysis;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class PopularityTest {
    @Test
    void scoresListenersOnALogScaleBetweenOneHundredAndTenMillion() {
        assertThat(Popularity.trackScore(100)).isZero();
        assertThat(Popularity.trackScore(10)).isZero();
        assertThat(Popularity.trackScore(100_000)).isCloseTo(60.0, within(1e-9));
        assertThat(Popularity.trackScore(10_000_000)).isEqualTo(100.0);
        assertThat(Popularity.trackScore(1_000_000_000)).isEqualTo(100.0);
    }

    @Test
    void averagesOnlyTracksWithKnownListeners() {
        var partial = Popularity.estimate(3, List.of(100_000L, 0L));
        assertThat(partial.mainstream()).isCloseTo(60.0, within(1e-9));
        assertThat(partial.warnings()).containsExactly(
                "분석한 3곡 중 1곡의 Last.fm 청취자 수를 확인했어요. 대중성은 이 1곡으로 계산했어요.");

        var complete = Popularity.estimate(2, List.of(100_000L, 10_000_000L));
        assertThat(complete.mainstream()).isCloseTo(80.0, within(1e-9));
        assertThat(complete.warnings()).isEmpty();
    }

    @Test
    void unknownListenersDoNotBecomeAZeroScore() {
        var none = Popularity.estimate(2, List.of());
        assertThat(none.mainstream()).isNull();
        assertThat(none.warnings()).containsExactly(
                "분석한 2곡 모두 Last.fm 청취자 수를 확인하지 못해 대중성을 계산하지 않았어요.");
        assertThat(Popularity.estimate(0, List.of()).warnings()).isEmpty();
    }
}
