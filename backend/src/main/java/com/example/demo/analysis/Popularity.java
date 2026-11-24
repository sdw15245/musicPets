package com.example.demo.analysis;

import java.util.List;

/**
 * Last.fm 청취자 수로 추정한 대중성(0~100)과, 일부 곡만 반영됐을 때 보여줄 안내.
 * 곡마다 청취자 100명 이하는 0점, 1천만 명 이상은 100점, 그 사이는 로그 비례로 매겨 평균을 낸다.
 * 청취자 수를 확인하지 못한 곡은 0점으로 치지 않고 평균에서 뺀다.
 */
record Popularity(Double mainstream, List<String> warnings) {

    /**
     * @param analyzedTracks 분석에 쓴 곡 수
     * @param listenerCounts 청취자 수를 확인한 곡들의 값. 0 이하는 확인하지 못한 것으로 본다.
     */
    static Popularity estimate(int analyzedTracks, List<Long> listenerCounts) {
        List<Long> found = listenerCounts.stream().filter(count -> count > 0).toList();
        Double mainstream = found.isEmpty() ? null
                : found.stream().mapToDouble(Popularity::trackScore).average().orElseThrow();
        return new Popularity(mainstream, coverageWarnings(analyzedTracks, found.size()));
    }

    static double trackScore(long listeners) {
        double scaled = (Math.log10(listeners) - 2) / 5;
        return Math.max(0, Math.min(1, scaled)) * 100;
    }

    private static List<String> coverageWarnings(int analyzed, int counted) {
        if (counted >= analyzed) return List.of();
        if (counted == 0) {
            return List.of("분석한 %d곡 모두 Last.fm 청취자 수를 확인하지 못해 대중성을 계산하지 않았어요.".formatted(analyzed));
        }
        return List.of("분석한 %d곡 중 %d곡의 Last.fm 청취자 수를 확인했어요. 대중성은 이 %d곡으로 계산했어요."
                .formatted(analyzed, counted, counted));
    }
}
