package com.example.demo.spotify;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

/**
 * Last.fm에서 받은 아티스트 이름을 Spotify 아티스트로 확인하는 규칙.
 * 검색 첫 결과만으로는 같은 아티스트라고 보지 않는다.
 */
public final class ArtistNames {
    private ArtistNames() {}

    /** 이름 비교용 키: 유니코드 정규화(NFKC), 소문자, 공백 하나로. */
    public static String key(String name) {
        return Normalizer.normalize(name, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }

    /**
     * 이름이 정확히 같은 결과가 하나면 그것. 둘 이상이면 모호하므로 null.
     * 정확히 같은 결과가 없으면, 한글과 영문을 함께 쓴 이름("데이먼스 이어 Damons year")에서
     * 단어 단위로 포함되는 결과가 하나일 때만 그것.
     */
    static SpotifyService.ArtistHit pick(String name, List<SpotifyService.ArtistHit> hits) {
        String wanted = key(name);
        var exact = hits.stream().filter(hit -> key(hit.name()).equals(wanted)).toList();
        if (!exact.isEmpty()) return exact.size() == 1 ? exact.getFirst() : null;
        if (!isBilingual(name)) return null;
        String padded = " " + wanted + " ";
        var partial = hits.stream().filter(hit -> padded.contains(" " + key(hit.name()) + " ")).toList();
        return partial.size() == 1 ? partial.getFirst() : null;
    }

    private static boolean isBilingual(String name) {
        return name.codePoints().anyMatch(c -> c >= 0xAC00 && c <= 0xD7A3) && name.matches(".*[A-Za-z].*");
    }
}
