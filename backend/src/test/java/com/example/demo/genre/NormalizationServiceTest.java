package com.example.demo.genre;

import com.example.demo.llm.GeminiClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class NormalizationServiceTest {
    private final GeminiClient gemini = mock(GeminiClient.class);
    private final TagNormalizationRepository repository = mock(TagNormalizationRepository.class);
    private final Map<String, TagNormalization> stored = new LinkedHashMap<>();
    private final NormalizationService service = new NormalizationService(
            new GenreDictionary(), repository, new LlmGenreClassifier(gemini));

    @BeforeEach
    void emulatePersistence() {
        // DB와 외부 API만 대체하고 실제 분류·정규화 코드를 함께 실행한다.
        when(repository.findAllById(any())).thenAnswer(invocation -> {
            Iterable<String> keys = invocation.getArgument(0);
            List<TagNormalization> rows = new ArrayList<>();
            for (String key : keys) {
                if (stored.containsKey(key)) rows.add(stored.get(key));
            }
            return rows;
        });
        when(repository.save(any(TagNormalization.class))).thenAnswer(invocation -> {
            TagNormalization row = invocation.getArgument(0);
            stored.put(row.getTag(), row);
            return row;
        });
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {
            "", "not JSON", "{\"dreamy electronic\":", "null", "[]", "{}",
            "{\"dreamy electronic\":null}",
            "{\"dreamy electronic\":\"unknown-genre\"}",
            "{\"dreamy electronic\":[\"electronic\"]}"
    })
    void invalidOrMissingAnswerIsNotCachedAndNextAnalysisCanClassifyIt(String response) {
        when(gemini.generate(anyString())).thenReturn(response)
                .thenReturn("{\"dreamy electronic\":\"electronic\"}");

        assertThat(service.normalizeAll(List.of("dreamy electronic")))
                .containsEntry("dreamy electronic", Optional.empty());
        assertThat(stored).isEmpty();

        assertThat(service.normalizeAll(List.of("dreamy electronic")))
                .containsEntry("dreamy electronic", Optional.of("electronic"));
        assertThat(stored.get("dreamy electronic").getMainGenre()).isEqualTo("electronic");
        verify(gemini, times(2)).generate(anyString());
    }

    @Test
    void explicitNoneIsCachedAndDoesNotCallGeminiAgain() {
        when(gemini.generate(anyString())).thenReturn("{\"favorites\":\"none\"}");

        assertThat(service.normalizeAll(List.of("favorites"))).containsEntry("favorites", Optional.empty());
        assertThat(stored).containsKey("favorites");
        assertThat(stored.get("favorites").getMainGenre()).isNull();
        assertThat(service.normalizeAll(List.of("favorites"))).containsEntry("favorites", Optional.empty());
        verify(gemini, times(1)).generate(anyString());
    }

    @Test
    void partialBatchCachesOnlyConfirmedAnswersAndRetriesMissingTag() {
        when(gemini.generate(anyString())).thenReturn("""
                ```json
                {" DREAMY ELECTRONIC ": " Electronic ", "favorites": " NONE "}
                ```
                """).thenReturn("{\"mystery tag\":\"indie\"}");

        assertThat(service.normalizeAll(List.of("dreamy electronic", "favorites", "mystery tag")))
                .containsEntry("dreamy electronic", Optional.of("electronic"))
                .containsEntry("favorites", Optional.empty())
                .containsEntry("mystery tag", Optional.empty());
        assertThat(stored).containsOnlyKeys("dreamy electronic", "favorites");

        assertThat(service.normalizeAll(List.of("dreamy electronic", "favorites", "mystery tag")))
                .containsEntry("dreamy electronic", Optional.of("electronic"))
                .containsEntry("mystery tag", Optional.of("indie"));
        assertThat(stored.get("mystery tag").getMainGenre()).isEqualTo("indie");
    }

    @Test
    void externalApiFailureDoesNotWriteCacheAndCanBeRetried() {
        when(gemini.generate(anyString())).thenThrow(new IllegalStateException("offline"))
                .thenReturn("{\"dreamy electronic\":\"electronic\"}");

        assertThatThrownBy(() -> service.normalizeAll(List.of("dreamy electronic")))
                .isInstanceOf(IllegalStateException.class);
        assertThat(stored).isEmpty();
        assertThat(service.normalizeAll(List.of("dreamy electronic")))
                .containsEntry("dreamy electronic", Optional.of("electronic"));
    }

    @Test
    void geminiRunsOutsideTheDatabaseTransaction() {
        var manager = new org.springframework.transaction.support.AbstractPlatformTransactionManager() {
            @Override protected Object doGetTransaction() { return new Object(); }
            @Override protected void doBegin(Object tx, org.springframework.transaction.TransactionDefinition definition) {}
            @Override protected void doCommit(org.springframework.transaction.support.DefaultTransactionStatus status) {}
            @Override protected void doRollback(org.springframework.transaction.support.DefaultTransactionStatus status) {}
        };
        var proxy = new org.springframework.aop.framework.ProxyFactory(service);
        var interceptor = new org.springframework.transaction.interceptor.TransactionInterceptor();
        interceptor.setTransactionManager(manager);
        interceptor.setTransactionAttributeSource(new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource());
        proxy.addAdvice(interceptor);
        when(gemini.generate(anyString())).thenAnswer(invocation -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return "{\"dreamy electronic\":\"electronic\"}";
        });
        var result = ((NormalizationService) proxy.getProxy()).normalizeAll(List.of("dreamy electronic"));
        assertThat(result).containsEntry("dreamy electronic", Optional.of("electronic"));
        assertThat(stored).containsKey("dreamy electronic");
    }
}
