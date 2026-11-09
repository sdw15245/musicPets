package com.example.demo.analysis;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.util.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc
class AnalysisHistoryTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired AnalysisStorage storage;
    @Autowired LatestAnalysisRepository latest;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @Autowired JwtTokenProvider tokens;
    User user() { return users.save(new User(UUID.randomUUID().toString(), "", "기록 주인")); }
    String auth(User user) { return "Bearer " + tokens.createAccessToken(user.getId()); }
    AnalysisResult result(String id) {
        return new AnalysisResult(id, Instant.now(), new AnalysisResult.Genres(Map.of("pop", 1.0), List.of(), 1, 1),
            null, new AnalysisResult.Profile(50.0, 50.0, "기록"), List.of(), true, List.of(), null);
    }
    @Test void keepsTenSnapshotsAndUpdatesDetailsWithoutDuplicates() throws Exception {
        User owner = user();
        for (int i = 0; i < 12; i++) storage.save(owner.getId(), result("run-" + i));
        storage.updateCurrent(owner.getId(), "run-11", saved -> saved.withProfile(new AnalysisResult.Profile(60.0, 40.0, "완료"), List.of()));
        mvc.perform(get("/api/analysis/history").header("Authorization", auth(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(10)).andExpect(jsonPath("$[0].id").value("run-11"));
        mvc.perform(get("/api/analysis/history/run-11").header("Authorization", auth(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.profile.comment").value("완료"));
        mvc.perform(get("/api/analysis/history/run-0").header("Authorization", auth(owner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/analysis/history/run-11").header("Authorization", auth(user()))).andExpect(status().isNotFound());
        mvc.perform(get("/api/analysis/history")).andExpect(status().isUnauthorized());
    }
    @Test void artistRecommendationsSurviveProfileUpdatesAndHistoricalReads() throws Exception {
        User owner = user();
        var artist = new com.example.demo.recommendation.RecommendationService.RecommendedArtist(
            "Redoor", "spotify:artist:redoor", "", List.of("HANRORO"));
        storage.save(owner.getId(), result("artists").withArtistRecommendations(List.of(artist)));
        storage.updateCurrent(owner.getId(), "artists", saved -> saved.withProfile(new AnalysisResult.Profile(50.0, 50.0, "완료"), List.of()));
        mvc.perform(get("/api/analysis/latest").header("Authorization", auth(owner)))
            .andExpect(jsonPath("$.recommendedArtists[0].uri").value("spotify:artist:redoor"));
        mvc.perform(get("/api/analysis/history/artists").header("Authorization", auth(owner)))
            .andExpect(jsonPath("$.recommendedArtists[0].basedOn[0]").value("HANRORO"))
            .andExpect(jsonPath("$.profile.comment").value("완료"));
    }
    @Test void fallbackPeriodAndNoticeSurviveStorageAndProfileUpdates() throws Exception {
        User owner = user();
        String notice = "최근 4주 청취곡이 없어 최근 6개월 기록으로 분석했어요.";
        var fallback = new AnalysisResult("fallback", Instant.now(),
            new AnalysisResult.Genres(Map.of("pop", 1.0), List.of(), 10, 20, "medium_term"),
            null, new AnalysisResult.Profile(null, null, ""), List.of(), true, List.of(notice), null);
        storage.save(owner.getId(), fallback);
        storage.updateCurrent(owner.getId(), "fallback", saved -> saved.withProfile(new AnalysisResult.Profile(50.0, 50.0, "완료"), List.of()));
        for (String path : List.of("/api/analysis/latest", "/api/analysis/history/fallback")) {
            mvc.perform(get(path).header("Authorization", auth(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.genres.timeRange").value("medium_term"))
                .andExpect(jsonPath("$.genres.trackCount").value(20))
                .andExpect(jsonPath("$.warnings[0]").value(notice));
        }
    }
    @Test void resultsWithoutArtistFieldStillDecodeAsLegacyTracks() throws Exception {
        var legacy = mapper.valueToTree(result("legacy-json"));
        ((com.fasterxml.jackson.databind.node.ObjectNode) legacy).remove("recommendedArtists");
        var decoded = mapper.treeToValue(legacy, AnalysisResult.class);
        org.assertj.core.api.Assertions.assertThat(decoded.recommendedArtists()).isNull();
        org.assertj.core.api.Assertions.assertThat(decoded.recommendations()).isEmpty();
    }
    @Test void legacyLatestIsIncludedAndDeletedLatestDoesNotReappear() throws Exception {
        User owner = user();
        String json = mapper.writeValueAsString(result("legacy"));
        new org.springframework.transaction.support.TransactionTemplate(transactions).executeWithoutResult(status -> {
            LatestAnalysis row = new LatestAnalysis(users.findById(owner.getId()).orElseThrow());
            row.replace("legacy", json);
            latest.save(row);
        });
        mvc.perform(get("/api/analysis/history").header("Authorization", auth(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value("legacy"));
        mvc.perform(delete("/api/analysis/history/legacy").header("Authorization", auth(user()))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/analysis/history/legacy").header("Authorization", auth(owner))).andExpect(status().isNoContent());
        mvc.perform(get("/api/analysis/history").header("Authorization", auth(owner))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/analysis/latest").header("Authorization", auth(owner))).andExpect(status().isNoContent());
    }
}
