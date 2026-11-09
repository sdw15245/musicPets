package com.example.demo.genre;

import com.example.demo.lastfm.LastfmTag;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 곡별 (태그+count) 리스트 → 사용자 13-dim vector.
 * 규칙:
 *   - 곡당 같은 메인 장르는 가장 높은 weight만 채택 (dedupe + 가중치).
 *   - 곡당 weight 상위 3개 메인 장르만 채택 (소수 노이즈 차단).
 *   - weight = Last.fm count / 100 (0~1).
 */
@Service
public class UserVectorService {

    private static final int TOP_GENRES_PER_TRACK = 3;

    private final NormalizationService normalizationService;

    public UserVectorService(NormalizationService normalizationService) {
        this.normalizationService = normalizationService;
    }

    public Result build(List<List<LastfmTag>> tagsPerTrack) {
        // 1) 전체 unique 태그명으로 정규화 한 번
        List<String> allUniqueTagNames = tagsPerTrack.stream()
                .flatMap(List::stream)
                .map(LastfmTag::name)
                .distinct()
                .toList();
        Map<String, Optional<String>> normalized = normalizationService.normalizeAll(allUniqueTagNames);

        // 2) 곡 단위: 메인 장르별 최대 weight 추출 → 누적
        Map<String, Double> weightedTotal = new HashMap<>();
        Set<String> unmappedDedup = new LinkedHashSet<>();

        for (List<LastfmTag> trackTags : tagsPerTrack) {
            Map<String, Double> perTrackMax = new HashMap<>();

            for (LastfmTag tag : trackTags) {
                Optional<String> genre = normalized.getOrDefault(tag.name(), Optional.empty());
                if (genre.isEmpty()) {
                    unmappedDedup.add(tag.name());
                    continue;
                }
                double weight = Math.max(0, Math.min(1.0, tag.count() / 100.0));
                perTrackMax.merge(genre.get(), weight, Math::max);
            }

            // 이 곡의 weight 상위 3개 장르만 누적 (노이즈 차단)
            perTrackMax.entrySet().stream()
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .limit(TOP_GENRES_PER_TRACK)
                    .forEach(e -> weightedTotal.merge(e.getKey(), e.getValue(), Double::sum));
        }

        // 3) 비율 vector (13개 키, 합 = 1.0)
        double total = weightedTotal.values().stream().mapToDouble(Double::doubleValue).sum();
        Map<String, Double> vector = new LinkedHashMap<>();
        for (String genre : GenreDictionary.MAIN_GENRES) {
            double w = weightedTotal.getOrDefault(genre, 0.0);
            vector.put(genre, total == 0 ? 0.0 : w / total);
        }

        return new Result(vector, new ArrayList<>(unmappedDedup));
    }

    public record Result(Map<String, Double> vector, List<String> unmappedTags) {}
}
