package com.example.demo.character;

import com.example.demo.genre.GenreDictionary;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/**
 * shared/characters.json을 도감과 매칭의 단일 정의로 사용한다.
 * Gradle이 JSON을 classpath에 포함하며, 13개 장르와 비율 합을 검증한다.
 */
public record Character(String slug, String name, String description, String imageUrl,
                        String color, String tag, Map<String, Double> vector, String story) {
    public Character {
        vector = Map.copyOf(vector);
    }

    public static final List<Character> POOL = load();

    private static List<Character> load() {
        try (var input = Character.class.getResourceAsStream("/characters.json")) {
            if (input == null) throw new IllegalStateException("Missing character catalog");
            List<Character> characters = new ObjectMapper().readValue(input, new TypeReference<>() {});
            var slugs = new HashSet<String>();
            for (Character character : characters) {
                if (!slugs.add(character.slug())
                        || character.story() == null || character.story().isBlank()
                        || !character.vector().keySet().equals(new HashSet<>(GenreDictionary.MAIN_GENRES))
                        || character.vector().values().stream().anyMatch(v -> !Double.isFinite(v) || v < 0)
                        || Math.abs(character.vector().values().stream().mapToDouble(Double::doubleValue).sum() - 1) > 0.000001) {
                    throw new IllegalStateException("Invalid character vector: " + character.slug());
                }
            }
            if (characters.isEmpty()) throw new IllegalStateException("Empty character catalog");
            return List.copyOf(characters);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot load character catalog", e);
        }
    }
}
