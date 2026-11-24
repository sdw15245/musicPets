package com.example.demo.character;

import com.example.demo.genre.GenreDictionary;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 음악 펫 캐릭터. shared/characters.json을 도감과 매칭의 단일 정의로 사용한다.
 * Gradle이 JSON을 classpath에 포함하며, 시작할 때 13개 장르와 비율 합을 검증한다.
 * (java.lang.Character와 이름이 겹치지 않도록 PetCharacter로 부른다.)
 */
public record PetCharacter(String slug, String name, String description, String imageUrl,
                           String color, String tag, Map<String, Double> vector, String story) {
    public PetCharacter {
        vector = Map.copyOf(vector);
    }

    /** 바뀌지 않는 묶음 데이터라 enum처럼 정적으로 한 번만 읽는다. */
    public static final List<PetCharacter> POOL = load();

    public static Optional<PetCharacter> find(String slug) {
        return POOL.stream().filter(character -> character.slug().equals(slug)).findFirst();
    }

    private static List<PetCharacter> load() {
        try (var input = PetCharacter.class.getResourceAsStream("/characters.json")) {
            if (input == null) throw new IllegalStateException("Missing character catalog");
            List<PetCharacter> characters = new ObjectMapper().readValue(input, new TypeReference<>() {});
            var slugs = new HashSet<String>();
            for (PetCharacter character : characters) {
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
