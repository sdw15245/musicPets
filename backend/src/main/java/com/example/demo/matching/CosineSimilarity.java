package com.example.demo.matching;

import com.example.demo.genre.GenreDictionary;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 두 장르 vector의 코사인 유사도(0~1).
 * 두 취향이 같은 방향을 가리킬수록 1에 가깝다. (크기가 아니라 방향을 비교)
 */
@Component
public class CosineSimilarity {

    public double compute(Map<String, Double> a, Map<String, Double> b) {
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
