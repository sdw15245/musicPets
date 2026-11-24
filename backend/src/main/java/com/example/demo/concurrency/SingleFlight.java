package com.example.demo.concurrency;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.function.Supplier;

/**
 * 같은 키의 작업이 이미 실행 중이면 새로 실행하지 않고 그 결과(또는 예외)를 함께 받는다.
 * 결과는 보관하지 않는다. 작업이 끝나면 다음 호출은 다시 실행한다.
 */
public final class SingleFlight<K, V> {
    private final ConcurrentHashMap<K, CompletableFuture<V>> running = new ConcurrentHashMap<>();

    public V run(K key, Supplier<V> work) {
        CompletableFuture<V> mine = new CompletableFuture<>();
        CompletableFuture<V> existing = running.putIfAbsent(key, mine);
        if (existing != null) return await(existing);
        try {
            V value = work.get();
            mine.complete(value);
            return value;
        } catch (RuntimeException | Error failure) {
            mine.completeExceptionally(failure);
            throw failure;
        } finally {
            running.remove(key, mine);
        }
    }

    /** 실행 중인 작업이 있으면 끝날 때까지 기다린다. 결과와 실패는 호출자가 따로 확인한다. */
    public void awaitIfRunning(K key) {
        CompletableFuture<V> existing = running.get(key);
        if (existing == null) return;
        try {
            existing.get();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for shared work", interrupted);
        } catch (ExecutionException ignored) {
            // 실패 여부는 호출자가 자신의 상태로 다시 확인한다.
        }
    }

    private static <V> V await(CompletableFuture<V> task) {
        try {
            return task.get();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for shared work", interrupted);
        } catch (ExecutionException failed) {
            if (failed.getCause() instanceof RuntimeException cause) throw cause;
            if (failed.getCause() instanceof Error cause) throw cause;
            throw new IllegalStateException("Shared work failed", failed.getCause());
        }
    }
}
