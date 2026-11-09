package com.example.demo.matching;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MatchServiceTest {
    private final MatchService service = new MatchService(new CosineSimilarity());

    @Test
    void differentTastesSelectDifferentCatalogCharacters() {
        assertThat(service.findTop1(Map.of("electronic", 1.0)).character().slug()).isEqualTo("pip");
        assertThat(service.findTop1(Map.of("jazz", 1.0)).character().slug()).isEqualTo("bongbong");
        assertThat(service.findTop1(Map.of("folk", 1.0)).character().slug()).isEqualTo("yuze");
        assertThat(service.findTop1(Map.of("pop", 0.6, "indie", 0.4)).character().slug()).isEqualTo("mochi");
        assertThat(service.findTop1(Map.of("hip-hop", 1.0)).character().slug()).isEqualTo("sulk-cat");
    }

    @Test
    void noEvidenceDoesNotUnlockAnArbitraryCharacter() {
        assertThat(service.findTop1(Map.of())).isNull();
    }
}
