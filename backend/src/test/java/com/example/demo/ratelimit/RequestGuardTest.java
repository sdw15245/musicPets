package com.example.demo.ratelimit;

import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.assertj.core.api.Assertions.*;
import static com.example.demo.ratelimit.RequestLimits.Operation.*;

class RequestGuardTest {
    final RequestLimits limits = new RequestLimits();
    final AtomicLong nanos = new AtomicLong();
    RequestGuard guard() { return new RequestGuard(limits, nanos::get, Clock.fixed(Instant.parse("2026-10-28T00:00:00Z"), ZoneOffset.UTC)); }
    void advance(long seconds) { nanos.addAndGet(TimeUnit.SECONDS.toNanos(seconds)); }

    @Test void userBudgetSurvivesAddressChangesAndRecoversAtExactBoundary() {
        RequestGuard guard = guard();
        guard.acquire(ANALYSIS, 1L, "ip1").close();
        assertThatThrownBy(() -> guard.acquire(ANALYSIS, 1L, "ip2")).isInstanceOfSatisfying(RequestLimitException.class,
                e -> { assertThat(e.limit().retryAfterSeconds()).isEqualTo(60); assertThat(e.limit().error()).isEqualTo("APP_RATE_LIMITED"); });
        advance(59);
        assertThatThrownBy(() -> guard.acquire(ANALYSIS, 1L, "ip3")).isInstanceOfSatisfying(RequestLimitException.class,
                e -> assertThat(e.limit().retryAfterSeconds()).isEqualTo(1));
        advance(1);
        guard.acquire(ANALYSIS, 1L, "ip3").close();
    }

    @Test void ipBudgetIsSharedAcrossUsersAndDifferentGroupsAreIndependent() {
        limits.getIpPerMinute().put(ANALYSIS, 2);
        RequestGuard guard = guard();
        guard.acquire(ANALYSIS, 1L, "shared").close();
        guard.acquire(ANALYSIS, 2L, "shared").close();
        assertThatThrownBy(() -> guard.acquire(ANALYSIS, 3L, "shared")).isInstanceOf(RequestLimitException.class);
        guard.acquire(SEARCH, 3L, "shared").close();
        guard.acquire(ANALYSIS, 3L, "other").close(); // IP rejection did not consume this user's budget.
    }

    @Test void rejectedUserDoesNotConsumeTheIpBudget() {
        limits.getIpPerMinute().put(ANALYSIS, 2);
        RequestGuard guard = guard();
        guard.acquire(ANALYSIS, 1L, "shared").close();
        for (int i = 0; i < 10; i++) assertThatThrownBy(() -> guard.acquire(ANALYSIS, 1L, "shared")).isInstanceOf(RequestLimitException.class);
        guard.acquire(ANALYSIS, 2L, "shared").close();
    }

    @Test void partialRefillDoesNotResetTheEntireBurst() {
        limits.getUserPerMinute().put(SEARCH, 2);
        RequestGuard guard = guard();
        guard.acquire(SEARCH, 1L, "ip").close(); guard.acquire(SEARCH, 1L, "ip").close();
        advance(30);
        guard.acquire(SEARCH, 1L, "ip").close();
        assertThatThrownBy(() -> guard.acquire(SEARCH, 1L, "ip")).isInstanceOfSatisfying(RequestLimitException.class,
                e -> assertThat(e.limit().retryAfterSeconds()).isEqualTo(30));
    }

    @Test void concurrencyIsGlobalAndPermitCloseIsIdempotent() {
        limits.setMaxConcurrentExternal(1);
        RequestGuard guard = guard();
        var permit = guard.acquire(SEARCH, 1L, "a");
        assertThatThrownBy(() -> guard.acquire(ANALYSIS, 2L, "b")).isInstanceOf(RequestLimitException.class);
        guard.acquire(READ, null, "public").close();
        permit.close(); permit.close();
        guard.acquire(ANALYSIS, 2L, "b").close();
    }

    @Test void aUserCannotRunAnalysisAndRecommendationsTogether() {
        RequestGuard guard = guard();
        var running = guard.acquire(ANALYSIS, 1L, "a");
        assertThatThrownBy(() -> guard.acquire(RECOMMENDATIONS, 1L, "b")).isInstanceOf(RequestLimitException.class);
        running.close();
        guard.acquire(RECOMMENDATIONS, 1L, "b").close();
    }

    @Test void fullRegistryRejectsNewActorsWithoutEvictingActiveBudgetsAndExpiresIdleActors() {
        limits.setMaxBuckets(2);
        RequestGuard guard = guard();
        guard.acquire(ANALYSIS, 1L, "a").close();
        assertThatThrownBy(() -> guard.acquire(ANALYSIS, 2L, "b")).isInstanceOf(RequestLimitException.class);
        assertThatThrownBy(() -> guard.acquire(ANALYSIS, 1L, "a")).isInstanceOf(RequestLimitException.class);
        advance(60);
        guard.acquire(ANALYSIS, 2L, "b").close();
    }

    @Test void rejectedRequestsCannotAllocateUnlimitedActorBuckets() {
        limits.setMaxBuckets(3);
        RequestGuard guard = guard();
        guard.acquire(ANALYSIS, 1L, "original").close();
        for (int i = 0; i < 20; i++) {
            String ip = "changed-" + i;
            assertThatThrownBy(() -> guard.acquire(ANALYSIS, 1L, ip)).isInstanceOf(RequestLimitException.class);
        }
        guard.acquire(READ, null, "guest").close();
    }

    @Test void parallelAdmissionCannotOverspendASingleUserBudget() throws Exception {
        RequestGuard guard = guard();
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var start = new CountDownLatch(1);
            var admitted = new AtomicLong();
            var jobs = new java.util.ArrayList<Future<?>>();
            for (int i = 0; i < 30; i++) jobs.add(pool.submit(() -> {
                try { start.await(); guard.acquire(ANALYSIS, 1L, "a").close(); admitted.incrementAndGet(); }
                catch (RequestLimitException ignored) {} catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }));
            start.countDown();
            for (var job : jobs) job.get(5, TimeUnit.SECONDS);
            assertThat(admitted.get()).isEqualTo(1);
        }
    }

    @Test void configurationRejectsZeroLimitsAndSupportsDisablingForIsolatedTests() {
        limits.getUserPerMinute().put(ANALYSIS, 0);
        assertThatThrownBy(this::guard).isInstanceOf(IllegalArgumentException.class);
        limits.getUserPerMinute().put(ANALYSIS, 1);
        limits.setEnabled(false);
        RequestGuard guard = guard();
        for (int i = 0; i < 50; i++) guard.acquire(ANALYSIS, 1L, "a").close();
    }
}
