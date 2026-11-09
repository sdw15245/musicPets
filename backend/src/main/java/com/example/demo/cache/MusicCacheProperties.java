package com.example.demo.cache;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.time.Duration;

@Component
@ConfigurationProperties(prefix = "app.music-cache")
public class MusicCacheProperties {
    private boolean enabled = true;
    private Duration tagsTtl = Duration.ofDays(7);
    private Duration metadataTtl = Duration.ofDays(1);
    private Duration emptyTtl = Duration.ofMinutes(10);
    private Duration retryDelay = Duration.ofSeconds(30);

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Duration getTagsTtl() { return tagsTtl; }
    public void setTagsTtl(Duration ttl) { tagsTtl = positive(ttl); }
    public Duration getMetadataTtl() { return metadataTtl; }
    public void setMetadataTtl(Duration ttl) { metadataTtl = positive(ttl); }
    public Duration getEmptyTtl() { return emptyTtl; }
    public void setEmptyTtl(Duration ttl) { emptyTtl = positive(ttl); }
    public Duration getRetryDelay() { return retryDelay; }
    public void setRetryDelay(Duration delay) { retryDelay = positive(delay); }

    private static Duration positive(Duration value) {
        if (value == null || value.isZero() || value.isNegative())
            throw new IllegalArgumentException("Music cache durations must be positive");
        return value;
    }
}
