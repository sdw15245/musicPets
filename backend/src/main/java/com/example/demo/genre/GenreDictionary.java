package com.example.demo.genre;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static java.util.Map.entry;

/**
 * Last.fm 태그 → 12 메인 장르 hard-coded 매핑.
 * 자주 등장하는 태그만 등록. 누락 태그는 LLM fallback으로 처리.
 */
@Component
public class GenreDictionary {

    public static final List<String> MAIN_GENRES = List.of(
            "pop", "rock", "indie", "electronic", "hip-hop", "r-and-b",
            "jazz", "classical", "folk", "metal", "latin", "k-pop", "j-pop"
    );

    private static final Map<String, String> DICTIONARY = Map.ofEntries(
            // pop
            entry("pop", "pop"),
            entry("synth-pop", "pop"),
            entry("synthpop", "pop"),
            entry("indie pop", "pop"),
            entry("electropop", "pop"),
            entry("dream pop", "pop"),
            entry("dance-pop", "pop"),
            entry("dance pop", "pop"),
            // rock
            entry("rock", "rock"),
            entry("hard rock", "rock"),
            entry("classic rock", "rock"),
            entry("alternative rock", "rock"),
            entry("alternative", "rock"),
            entry("post-rock", "rock"),
            entry("punk", "rock"),
            entry("punk rock", "rock"),
            // indie
            entry("indie", "indie"),
            entry("indie rock", "indie"),
            entry("shoegaze", "indie"),
            entry("dream-pop", "indie"),
            entry("lo-fi", "indie"),
            // electronic
            entry("electronic", "electronic"),
            entry("edm", "electronic"),
            entry("techno", "electronic"),
            entry("house", "electronic"),
            entry("deep house", "electronic"),
            entry("synthwave", "electronic"),
            entry("ambient", "electronic"),
            entry("nu-disco", "electronic"),
            entry("disco", "electronic"),
            entry("dubstep", "electronic"),
            // hip-hop
            entry("hip hop", "hip-hop"),
            entry("hip-hop", "hip-hop"),
            entry("hiphop", "hip-hop"),
            entry("rap", "hip-hop"),
            entry("trap", "hip-hop"),
            entry("korean hip hop", "hip-hop"),
            entry("k-rap", "hip-hop"),
            // r-and-b
            entry("rnb", "r-and-b"),
            entry("r&b", "r-and-b"),
            entry("soul", "r-and-b"),
            entry("neo-soul", "r-and-b"),
            // jazz
            entry("jazz", "jazz"),
            entry("smooth jazz", "jazz"),
            entry("bossa nova", "jazz"),
            // classical
            entry("classical", "classical"),
            entry("orchestral", "classical"),
            entry("baroque", "classical"),
            // folk
            entry("folk", "folk"),
            entry("acoustic", "folk"),
            entry("singer-songwriter", "folk"),
            entry("country", "folk"),
            // metal
            entry("metal", "metal"),
            entry("heavy metal", "metal"),
            entry("death metal", "metal"),
            // latin
            entry("latin", "latin"),
            entry("reggaeton", "latin"),
            entry("latin trap", "latin"),
            // k-pop
            entry("k-pop", "k-pop"),
            entry("kpop", "k-pop"),
            // j-pop
            entry("j-pop", "j-pop"),
            entry("jpop", "j-pop"),
            entry("city pop", "j-pop")
    );

    /** 매핑된 메인 장르, 또는 null (사전에 없음). */
    public String lookup(String tag) {
        if (tag == null) return null;
        return DICTIONARY.get(tag.toLowerCase().trim());
    }
}
