package com.example.demo.concurrency;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SingleFlightTest {
    private final SingleFlight<String, String> flights = new SingleFlight<>();

    @Test
    void concurrentCallersShareOneRunAndTheNextCallRunsAgain() throws Exception {
        var runs = new AtomicInteger();
        var started = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> flights.run("key", () -> {
                runs.incrementAndGet();
                started.countDown();
                await(release);
                return "shared";
            }));
            assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
            var secondThread = new AtomicReference<Thread>();
            var second = executor.submit(() -> {
                secondThread.set(Thread.currentThread());
                return flights.run("key", () -> "second run");
            });
            Awaitility.await().atMost(2, TimeUnit.SECONDS).until(() ->
                    secondThread.get() != null && secondThread.get().getState() == Thread.State.WAITING);
            release.countDown();
            assertThat(first.get(2, TimeUnit.SECONDS)).isEqualTo("shared");
            assertThat(second.get(2, TimeUnit.SECONDS)).isEqualTo("shared");
        }
        assertThat(flights.run("key", () -> "fresh")).isEqualTo("fresh");
        assertThat(runs).hasValue(1);
    }

    @Test
    void failureReachesWaitersAndIsNotKept() throws Exception {
        var failure = new IllegalStateException("offline");
        var started = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> flights.run("key", () -> {
                started.countDown();
                await(release);
                throw failure;
            }));
            assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
            var waiter = executor.submit(() -> {
                flights.awaitIfRunning("key");
                return "settled";
            });
            release.countDown();
            assertThat(waiter.get(2, TimeUnit.SECONDS)).isEqualTo("settled");
            assertThatThrownBy(() -> first.get(2, TimeUnit.SECONDS)).hasCause(failure);
        }
        assertThat(flights.run("key", () -> "recovered")).isEqualTo("recovered");
    }

    @Test
    void awaitIfRunningReturnsImmediatelyWhenIdle() {
        flights.awaitIfRunning("idle");
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Test timed out");
        } catch (InterruptedException e) {
            throw new IllegalStateException(e);
        }
    }
}
