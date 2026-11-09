package com.example.demo.community;

import com.example.demo.spotify.SpotifyService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/api/tracks")
public class TrackSearchController {
    private final SpotifyService spotify;
    public TrackSearchController(SpotifyService spotify) { this.spotify = spotify; }

    @GetMapping("/search")
    public List<SpotifyService.TrackHit> search(@AuthenticationPrincipal Long userId, @RequestParam String q) {
        String query = q.strip();
        if (query.isBlank() || query.length() > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어는 1~100자로 입력해주세요.");
        return spotify.searchTracks(userId, query, 10);
    }
}
