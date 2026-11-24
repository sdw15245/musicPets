package com.example.demo.spotify;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Spotify 곡 URI(spotify:track:&lt;22자 base62 ID&gt;). 형식이 맞는 값만 만들 수 있다. */
public record TrackUri(String id) {
    private static final String PREFIX = "spotify:track:";
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9]{22}");
    private static final Pattern URI = Pattern.compile(Pattern.quote(PREFIX) + "(" + ID.pattern() + ")");

    public TrackUri {
        if (id == null || !ID.matcher(id).matches()) throw new IllegalArgumentException("Invalid Spotify track id");
    }

    public static Optional<TrackUri> parse(String uri) {
        if (uri == null) return Optional.empty();
        Matcher matcher = URI.matcher(uri);
        return matcher.matches() ? Optional.of(new TrackUri(matcher.group(1))) : Optional.empty();
    }

    public String value() {
        return PREFIX + id;
    }
}
