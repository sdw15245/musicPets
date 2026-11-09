package com.example.demo.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.EnumMap;
import java.util.Map;

/** Initial service budgets, configurable independently from upstream API quotas. */
@ConfigurationProperties("app.rate-limit")
public class RequestLimits {
    public enum Operation {
        ANALYSIS(1, 10, true), PROFILE(2, 10, true), RECOMMENDATIONS(2, 10, true), PLAYLIST(2, 10, true),
        SEARCH(30, 120, true), WRITE(30, 120, false), READ(120, 300, false);
        final int userDefault;
        final int ipDefault;
        final boolean external;
        Operation(int user, int ip, boolean external) { this.userDefault = user; this.ipDefault = ip; this.external = external; }
        // 프로필은 같은 분석의 추천 아티스트와 병렬로 실행하되 외부 호출 총량 제한은 공유한다.
        boolean heavy() { return this == ANALYSIS || this == RECOMMENDATIONS || this == PLAYLIST; }
    }

    private boolean enabled = true;
    private int maxBuckets = 20_000;
    private int maxConcurrentExternal = 8;
    private final Map<Operation, Integer> userPerMinute = new EnumMap<>(Operation.class);
    private final Map<Operation, Integer> ipPerMinute = new EnumMap<>(Operation.class);

    public RequestLimits() {
        for (Operation operation : Operation.values()) {
            userPerMinute.put(operation, operation.userDefault);
            ipPerMinute.put(operation, operation.ipDefault);
        }
    }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getMaxBuckets() { return maxBuckets; }
    public void setMaxBuckets(int value) { maxBuckets = value; }
    public int getMaxConcurrentExternal() { return maxConcurrentExternal; }
    public void setMaxConcurrentExternal(int value) { maxConcurrentExternal = value; }
    public Map<Operation, Integer> getUserPerMinute() { return userPerMinute; }
    public Map<Operation, Integer> getIpPerMinute() { return ipPerMinute; }

    void validate() {
        if (maxBuckets < 2 || maxBuckets > 1_000_000 || maxConcurrentExternal < 1 || maxConcurrentExternal > 1_000)
            throw new IllegalArgumentException("Invalid request limit capacity");
        for (Operation operation : Operation.values()) {
            Integer user = userPerMinute.get(operation), ip = ipPerMinute.get(operation);
            if (user == null || ip == null || user < 1 || ip < user || ip > 100_000)
                throw new IllegalArgumentException("Invalid request budget for " + operation);
        }
    }
}
