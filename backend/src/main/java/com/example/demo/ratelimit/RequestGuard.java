package com.example.demo.ratelimit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.LongSupplier;
import static com.example.demo.ratelimit.RequestLimits.Operation;

/** Bounded, atomic token buckets. No forwarded headers or client-supplied user IDs are trusted. */
@Component
public class RequestGuard {
    private static final long MINUTE = TimeUnit.MINUTES.toNanos(1);
    private final RequestLimits limits;
    private final LongSupplier ticker;
    private final Clock clock;
    private final Map<Key, Bucket> buckets = new HashMap<>();
    private final Map<Long, Boolean> activeHeavyUsers = new HashMap<>();
    private long lastSweep;
    private int activeExternal;
    private record Key(Operation operation, String actor) {}

    private static class Bucket {
        final int capacity;
        long credits;
        long updated;
        Bucket(int capacity, long now) { this.capacity = capacity; credits = MINUTE * capacity; updated = now; }
        long available(long now) {
            long refill = Math.min(MINUTE, Math.max(0, now - updated)) * capacity;
            return Math.min(MINUTE * capacity, credits + refill);
        }
        long waitSeconds(long now) {
            long missing = Math.max(0, MINUTE - available(now));
            long nanos = (missing + capacity - 1) / capacity;
            return (nanos + TimeUnit.SECONDS.toNanos(1) - 1) / TimeUnit.SECONDS.toNanos(1);
        }
        void consume(long now) { credits = available(now) - MINUTE; updated = now; }
    }

    @Autowired
    public RequestGuard(RequestLimits limits) { this(limits, System::nanoTime, Clock.systemUTC()); }
    RequestGuard(RequestLimits limits, LongSupplier ticker, Clock clock) {
        limits.validate();
        this.limits = limits; this.ticker = ticker; this.clock = clock; lastSweep = ticker.getAsLong();
    }

    public static final class Permit implements AutoCloseable {
        private final Runnable release;
        private final AtomicBoolean closed = new AtomicBoolean();
        private Permit(Runnable release) { this.release = release; }
        @Override public void close() { if (closed.compareAndSet(false, true)) release.run(); }
    }

    public synchronized Permit acquire(Operation operation, Long userId, String remoteAddress) {
        if (!limits.isEnabled()) return new Permit(() -> {});
        long now = ticker.getAsLong();
        if (now - lastSweep >= MINUTE) {
            buckets.entrySet().removeIf(entry -> now - entry.getValue().updated >= MINUTE);
            lastSweep = now;
        }
        Key ip = new Key(operation, "ip:" + remoteAddress);
        Key user = userId == null ? null : new Key(operation, "user:" + userId);
        int needed = (buckets.containsKey(ip) ? 0 : 1) + (user == null || buckets.containsKey(user) ? 0 : 1);
        Bucket ipBucket = buckets.get(ip);
        if (ipBucket == null) ipBucket = new Bucket(limits.getIpPerMinute().get(operation), now);
        Bucket userBucket = user == null ? null : buckets.get(user);
        if (user != null && userBucket == null) userBucket = new Bucket(limits.getUserPerMinute().get(operation), now);
        long wait = Math.max(ipBucket.waitSeconds(now), userBucket == null ? 0 : userBucket.waitSeconds(now));
        if (wait > 0) throw rejected(operation, wait);
        if (operation.external && activeExternal >= limits.getMaxConcurrentExternal()
                || operation.heavy() && userId != null && activeHeavyUsers.containsKey(userId)) throw rejected(operation, 2);
        if (buckets.size() + needed > limits.getMaxBuckets()) throw rejected(operation, 60);
        // Check both budgets and concurrency before consuming either budget.
        buckets.put(ip, ipBucket);
        if (user != null) buckets.put(user, userBucket);
        ipBucket.consume(now);
        if (userBucket != null) userBucket.consume(now);
        if (operation.external) activeExternal++;
        if (operation.heavy() && userId != null) activeHeavyUsers.put(userId, true);
        return new Permit(() -> release(operation, userId));
    }

    private RequestLimitException rejected(Operation operation, long seconds) {
        return new RequestLimitException(seconds, clock.instant(), operation);
    }
    private synchronized void release(Operation operation, Long userId) {
        if (operation.external) activeExternal--;
        if (operation.heavy() && userId != null) activeHeavyUsers.remove(userId);
    }
}
