package com.example.demo.matching;

import com.example.demo.character.PetCharacter;
import com.example.demo.genre.GenreDictionary;
import org.springframework.stereotype.Service;

import java.util.Map;

/** 사용자 장르 vector를 캐릭터 풀과 비교해 가장 유사한 1개를 고른다. */
@Service
public class MatchService {

    public record MatchResult(PetCharacter character, double score) {}

    /** 들은 장르가 하나도 없으면 null(펫을 지어내지 않는다). */
    public MatchResult findTop1(Map<String, Double> userVector) {
        if (userVector.values().stream().noneMatch(v -> v > 0)) return null;
        PetCharacter best = null;
        double bestScore = -1;
        for (PetCharacter c : PetCharacter.POOL) {
            double s = cosine(userVector, c.vector());
            if (s > bestScore) {
                bestScore = s;
                best = c;
            }
        }
        return new MatchResult(best, Math.max(0, Math.min(1, bestScore)));
    }

    /**
     * 두 장르 vector의 코사인 유사도(0~1).
     * 두 취향이 같은 방향을 가리킬수록 1에 가깝다. (크기가 아니라 방향을 비교)
     */
    static double cosine(Map<String, Double> a, Map<String, Double> b) {
        double dot = 0, normA = 0, normB = 0;
        for (String genre : GenreDictionary.MAIN_GENRES) {
            double va = a.getOrDefault(genre, 0.0);
            double vb = b.getOrDefault(genre, 0.0);
            dot += va * vb;
            normA += va * va;
            normB += vb * vb;
        }
        if (normA == 0 || normB == 0) return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
