package com.example.demo.spotify;

import com.example.demo.analysis.AnalysisController;
import com.example.demo.analysis.AnalysisExceptionHandler;
import com.example.demo.analysis.AnalysisService;
import com.example.demo.recommendation.RecommendationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.interceptor.MatchAlwaysTransactionAttributeSource;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.anything;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

class SpotifyTokenServiceTest {
    private final SpotifyTokenRepository repository = mock(SpotifyTokenRepository.class);
    private final PlatformTransactionManager transactions = spy(new TestTransactions());
    private final AtomicReference<SpotifyToken> stored = new AtomicReference<>(
            new SpotifyToken(7L, "old-access", "old-refresh", Instant.now().minusSeconds(60)));
    private MockRestServiceServer server;
    private SpotifyTokenService service;

    @BeforeEach
    void setup() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        ProxyFactory repositoryProxy = new ProxyFactory(repository);
        repositoryProxy.setInterfaces(SpotifyTokenRepository.class);
        TransactionInterceptor repositoryTransactions = new TransactionInterceptor();
        repositoryTransactions.setTransactionManager(transactions);
        repositoryTransactions.setTransactionAttributeSource(new MatchAlwaysTransactionAttributeSource());
        repositoryProxy.addAdvice(repositoryTransactions);
        SpotifyTokenService target = new SpotifyTokenService((SpotifyTokenRepository) repositoryProxy.getProxy(),
                "test-client", "test-secret", builder);
        ProxyFactory proxy = new ProxyFactory(target);
        TransactionInterceptor interceptor = new TransactionInterceptor();
        interceptor.setTransactionManager(transactions);
        interceptor.setTransactionAttributeSource(new AnnotationTransactionAttributeSource());
        proxy.addAdvice(interceptor);
        service = (SpotifyTokenService) proxy.getProxy();
        when(repository.findById(7L)).thenAnswer(invocation -> Optional.ofNullable(stored.get()));
        when(repository.deleteIfCurrent(eq(7L), anyString())).thenAnswer(invocation -> {
            SpotifyToken current = stored.get();
            if (current == null || !current.getAccessToken().equals(invocation.getArgument(1))) return 0;
            stored.set(null);
            return 1;
        });
        when(repository.replaceIfCurrent(eq(7L), anyString(), anyString(), anyString(), any())).thenAnswer(invocation -> {
            SpotifyToken current = stored.get();
            if (current == null || !current.getAccessToken().equals(invocation.getArgument(1))) return 0;
            stored.set(new SpotifyToken(7L, invocation.getArgument(2), invocation.getArgument(3), invocation.getArgument(4)));
            return 1;
        });
    }

    @Test
    void invalidGrantDeletesTokensAndCommitsEvenWhenReauthorizationIsReported() {
        server.expect(requestTo("https://accounts.spotify.com/api/token"))
                .andExpect(request -> assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("refresh_token=old-refresh")))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalid_grant\"}"));

        assertThatThrownBy(() -> service.getValidAccessToken(7L)).isInstanceOf(RuntimeException.class);
        assertThat(stored.get()).isNull();
        verify(transactions, atLeastOnce()).commit(any());
        verify(transactions, never()).rollback(any());
        // 삭제 후 다른 요청이 들어와도 같은 토큰으로 Spotify 갱신을 재시도하지 않는다.
        assertThatThrownBy(() -> service.getValidAccessToken(7L)).isInstanceOf(RuntimeException.class);
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"error\":\"invalid_client\"}", "not-json", "{}"})
    void otherBadRequestsKeepTokens(String body) {
        server.expect(anything()).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body(body));
        assertThatThrownBy(() -> service.getValidAccessToken(7L)).isInstanceOf(RuntimeException.class);
        assertThat(stored.get().getRefreshToken()).isEqualTo("old-refresh");
        verify(repository, never()).deleteIfCurrent(any(), any());
        server.verify();
    }

    @Test
    void temporaryFailureKeepsTokensAndAllowsLaterRefresh() {
        server.expect(anything()).andRespond(withServerError());
        server.expect(anything()).andRespond(withSuccess(
                "{\"access_token\":\"new-access\",\"expires_in\":3600}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.getValidAccessToken(7L)).isInstanceOf(RuntimeException.class);
        assertThat(stored.get().getRefreshToken()).isEqualTo("old-refresh");
        assertThat(service.getValidAccessToken(7L)).isEqualTo("new-access");
        assertThat(stored.get().getRefreshToken()).isEqualTo("old-refresh");
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"access_token\":\"\",\"expires_in\":3600}", "{\"access_token\":\"new\",\"expires_in\":0}"})
    void malformedRefreshDoesNotReplaceStoredToken(String body) {
        server.expect(anything()).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.getValidAccessToken(7L))
                .isInstanceOf(org.springframework.web.client.RestClientException.class);
        assertThat(stored.get().getAccessToken()).isEqualTo("old-access");
        verify(repository, never()).replaceIfCurrent(any(), any(), any(), any(), any());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void refreshCannotOverwriteOrDeleteANewerLogin(boolean success) {
        server.expect(anything()).andRespond(request -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            stored.set(new SpotifyToken(7L, "login-access", "login-refresh", Instant.now().plusSeconds(3600)));
            return success ? withSuccess("{\"access_token\":\"stale-refresh\",\"expires_in\":3600}", MediaType.APPLICATION_JSON)
                    .createResponse(request) : withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"invalid_grant\"}").createResponse(request);
        });
        assertThat(service.getValidAccessToken(7L)).isEqualTo("login-access");
        assertThat(stored.get().getRefreshToken()).isEqualTo("login-refresh");
    }

    private static class TestTransactions extends AbstractPlatformTransactionManager {
        @Override protected Object doGetTransaction() { return new Object(); }
        @Override protected void doBegin(Object tx, TransactionDefinition definition) {}
        @Override protected void doCommit(DefaultTransactionStatus status) {}
        @Override protected void doRollback(DefaultTransactionStatus status) {}
    }

    @Test
    void simultaneousRequestsRefreshOnlyOnce() throws Exception {
        var started = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        server.expect(anything()).andRespond(request -> {
            started.countDown();
            try {
                if (!release.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new AssertionError("Refresh timed out");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new AssertionError(e);
            }
            return withSuccess("{\"access_token\":\"new-access\",\"expires_in\":3600}", MediaType.APPLICATION_JSON).createResponse(request);
        });
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> service.getValidAccessToken(7L));
            assertThat(started.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            var second = executor.submit(() -> service.getValidAccessToken(7L));
            release.countDown();
            assertThat(first.get(5, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo("new-access");
            assertThat(second.get(5, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo("new-access");
            verify(repository, times(1)).replaceIfCurrent(any(), any(), any(), any(), any());
            server.verify();
        } finally {
            release.countDown();
        }
    }

    @Test
    void invalidGrantHasDedicatedApiErrorInsteadOfJwtRefreshOrGenericFailure() throws Exception {
        server.expect(anything()).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\":\"invalid_grant\"}"));
        AnalysisService analysis = mock(AnalysisService.class);
        when(analysis.analyze(any())).thenAnswer(invocation -> {
            service.getValidAccessToken(7L);
            throw new AssertionError("Expired grant must not return an access token");
        });
        var mvc = MockMvcBuilders.standaloneSetup(new AnalysisController(analysis, mock(RecommendationService.class), mock(com.example.demo.analysis.AnalysisStorage.class)))
                .setControllerAdvice(new AnalysisExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        mvc.perform(post("/api/analysis"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("SPOTIFY_REAUTH_REQUIRED"));
        server.verify();
    }
}
