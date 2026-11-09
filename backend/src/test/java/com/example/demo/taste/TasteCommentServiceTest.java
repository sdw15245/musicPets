package com.example.demo.taste;

import com.example.demo.llm.GeminiClient;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class TasteCommentServiceTest {
    @Test
    void samePetReceivesItsFixedStoryAndEachUsersDifferentGenreEvidence() {
        var gemini = mock(GeminiClient.class);
        when(gemini.generateWithoutThinking(anyString())).thenReturn("취향과 펫을 연결한 해설");
        var service = new TasteCommentService(gemini);
        service.comment(Map.of("indie", .4, "hip-hop", .35, "r-and-b", .25), null, "sulk-cat");
        service.comment(Map.of("indie", .4, "rock", .35, "pop", .25), null, "sulk-cat");
        var prompts = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(gemini, times(2)).generateWithoutThinking(prompts.capture());
        for (String prompt : prompts.getAllValues()) {
            assertThat(prompt).contains("삐냥", "레코드 가게", "펫의 설정", "사용자의 실제 행동", "indie 40.0%");
            assertThat(prompt).doesNotContain("도도한 리듬 탐험가");
            assertThat(prompt).contains("한 문장 안에서 직접 연결", "입력의 모든 장르를 나열하지", "설정에 없는 행동");
        }
        assertThat(prompts.getAllValues().get(0)).contains("hip-hop 35.0%, r-and-b 25.0%");
        assertThat(prompts.getAllValues().get(1)).contains("rock 35.0%, pop 25.0%");
    }

    @Test
    void absentOrUnknownPetDoesNotInventAStoryAndNoEvidenceSkipsTheModel() {
        var gemini = mock(GeminiClient.class);
        when(gemini.generateWithoutThinking(anyString())).thenReturn("장르 해설");
        var service = new TasteCommentService(gemini);
        service.comment(Map.of("pop", 1.0), null, "retired-pet");
        service.comment(Map.of("pop", 1.0), null, null);
        var prompt = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(gemini, times(2)).generateWithoutThinking(prompt.capture());
        assertThat(prompt.getAllValues()).allSatisfy(value -> assertThat(value).contains("펫 연결 없이 장르만 설명"));
        clearInvocations(gemini);
        assertThat(service.comment(Map.of(), null, "sulk-cat")).contains("데이터가 부족");
        verifyNoInteractions(gemini);
    }

    @Test
    void sameGenreOrderWithDifferentWeightsGivesGeminiDifferentEvidence() {
        GeminiClient gemini = mock(GeminiClient.class);
        when(gemini.generateWithoutThinking(anyString())).thenReturn("AI가 쓴 취향 설명");
        var service = new TasteCommentService(gemini);
        assertThat(service.comment(Map.of("pop", .9, "indie", .1, "jazz", 0.0), null, null)).isEqualTo("AI가 쓴 취향 설명");
        service.comment(Map.of("pop", .51, "indie", .49), null, null);
        var prompts = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(gemini, times(2)).generateWithoutThinking(prompts.capture());
        assertThat(prompts.getAllValues().get(0)).contains("pop 90.0%, indie 10.0%").doesNotContain("jazz");
        assertThat(prompts.getAllValues().get(1)).contains("pop 51.0%, indie 49.0%");
    }

    @Test
    void blankAndFailedGeminiResponsesStillExplainTheMeasuredGenres() {
        GeminiClient gemini = mock(GeminiClient.class);
        when(gemini.generateWithoutThinking(anyString())).thenReturn(" ").thenThrow(new IllegalStateException("offline"));
        TasteCommentService service = new TasteCommentService(gemini);
        assertThat(service.comment(Map.of("jazz", 1.0), null, null)).contains("jazz", "장르 요약");
        assertThat(service.comment(Map.of("jazz", 1.0), 60.0, null)).contains("jazz", "장르 요약");
    }
}

