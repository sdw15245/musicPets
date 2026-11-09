package com.example.demo.analysis;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.user.ProfileService;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class ProfilePersistenceTest {
    @Autowired UserRepository users;
    @Autowired LatestAnalysisRepository results;
    @Autowired AnalysisStorage storage;
    @Autowired ProfileService profiles;
    @Autowired JwtTokenProvider tokens;
    @Autowired MockMvc mvc;

    private User user() { return users.save(new User(UUID.randomUUID().toString(), "", "Spotify 이름")); }
    private String bearer(User user) { return "Bearer " + tokens.createAccessToken(user.getId()); }
    private AnalysisResult result(String id, String pet) {
        return new AnalysisResult(id, Instant.now(), new AnalysisResult.Genres(Map.of("pop", 1.0), List.of(), 1, 1),
                pet == null ? null : new AnalysisResult.MatchedCharacter(pet, pet, "test", "/test.png", .9),
                new AnalysisResult.Profile(50.0, 50.0, "저장된 설명"), List.of(), true, List.of(), null);
    }

    @Test void latestResultAndCollectionSurviveSeparateTransactionsWithoutDuplicates() {
        User user = user();
        assertThat(storage.latest(user.getId())).isEmpty();
        storage.save(user.getId(), result("first", "mochi"));
        storage.save(user.getId(), result("second", "pip"));
        storage.save(user.getId(), result("third", "pip"));
        assertThat(storage.latest(user.getId()).orElseThrow().id()).isEqualTo("third");
        assertThat(profiles.get(user.getId()).unlockedCharacters()).containsExactlyInAnyOrder("mochi", "pip");
        assertThat(profiles.get(user.getId()).analyzedPet()).isEqualTo("pip");
        assertThatThrownBy(() -> storage.updateCurrent(user.getId(), "first", saved -> result("first", "mochi")))
                .isInstanceOf(AnalysisExpiredException.class);
        assertThat(storage.latest(user.getId()).orElseThrow().id()).isEqualTo("third");
        storage.save(user.getId(), result("empty", null));
        assertThat(profiles.get(user.getId()).analyzedPet()).isNull();
        assertThat(profiles.get(user.getId()).unlockedCharacters()).hasSize(2);
    }

    @Test void editedNicknameSurvivesSpotifyLoginWhileProfilePetFollowsAnalysis() {
        User user = user();
        profiles.edit(user.getId(), new ProfileService.EditProfile("  내 별명  "));
        User reloaded = users.findById(user.getId()).orElseThrow();
        reloaded.updateProfile("changed@example.com", "새 Spotify 이름");
        users.save(reloaded);
        storage.save(user.getId(), result("analysis", "pip"));
        var profile = profiles.get(user.getId());
        assertThat(profile.nickname()).isEqualTo("내 별명");
        assertThat(profile.displayName()).isEqualTo("새 Spotify 이름");
        assertThat(profile.analyzedPet()).isEqualTo("pip");
        storage.save(user.getId(), result("next-analysis", "mochi"));
        assertThat(profiles.get(user.getId()).analyzedPet()).isEqualTo("mochi");
        assertThat(profiles.get(user.getId()).nickname()).isEqualTo("내 별명");
    }

    @Test void independentlyCompletedCardsMergeIntoTheSameSavedPet() throws Exception {
        User owner = user();
        var base = result("staged", "pip");
        storage.save(owner.getId(), new AnalysisResult(base.id(), base.analyzedAt(), base.genres(), base.character(),
                new AnalysisResult.Profile(null, null, ""), List.of(), false, List.of(), null, true, true, List.of()));
        var artist = new com.example.demo.recommendation.RecommendationService.RecommendedArtist("가수", "spotify:artist:1", "", List.of("기준 가수"));
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var workers = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var profile = workers.submit(() -> {
                start.await();
                return storage.updateCurrent(owner.getId(), base.id(), saved -> saved.withProfile(base.profile(), List.of("일부 곡 제외")));
            });
            var recommendations = workers.submit(() -> {
                start.await();
                return storage.updateCurrent(owner.getId(), base.id(), saved -> saved.withArtistRecommendations(List.of(artist)));
            });
            start.countDown();
            profile.get(5, java.util.concurrent.TimeUnit.SECONDS);
            recommendations.get(5, java.util.concurrent.TimeUnit.SECONDS);
        }
        var saved = storage.latest(owner.getId()).orElseThrow();
        assertThat(saved.profilePending() || saved.recommendationsPending()).isFalse();
        assertThat(saved.profile()).isEqualTo(base.profile());
        assertThat(saved.recommendedArtists()).containsExactly(artist);
        assertThat(saved.warnings()).containsExactly("일부 곡 제외");
        mvc.perform(post("/api/analysis/staged/profile").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.profile.comment").value("저장된 설명"));
        mvc.perform(post("/api/analysis/staged/profile").header("Authorization", bearer(user())))
                .andExpect(status().isConflict());
    }

    @Test void endpointsUseAuthenticatedOwnerAndRejectGuestAndInvalidProfile() throws Exception {
        User first = user();
        User other = user();
        storage.save(first.getId(), result("private-result", "mochi"));
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/analysis/latest")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/me").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"침입\",\"avatar\":\"none\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/analysis/latest").header("Authorization", bearer(other)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/analysis/latest").header("Authorization", bearer(first)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value("private-result"));
        mvc.perform(put("/api/me").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"수정 이름\",\"avatar\":\"none\",\"userId\":" + other.getId() + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("수정 이름"))
                .andExpect(jsonPath("$.analyzedPet").value("mochi")).andExpect(jsonPath("$.avatar").doesNotExist());
        assertThat(profiles.get(other.getId()).nickname()).isNull();
        for (String body : List.of("{\"name\":\"  \"}", "{}", "{\"name\":\"줄\\n바꿈\"}",
                "{\"name\":\"" + "a".repeat(31) + "\"}")) {
            mvc.perform(put("/api/me").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertThat(profiles.get(first.getId()).nickname()).isEqualTo("수정 이름");
        mvc.perform(put("/api/me").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"이름만 수정\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("이름만 수정"))
                .andExpect(jsonPath("$.analyzedPet").value("mochi"));
    }
}
