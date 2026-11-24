package com.example.demo.analysis;

import com.example.demo.error.ErrorCode;
import com.example.demo.error.FallbackError;
import com.example.demo.ratelimit.RateLimited;
import com.example.demo.ratelimit.RequestLimits.Operation;
import com.example.demo.recommendation.RecommendationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analysis")
@FallbackError(ErrorCode.ANALYSIS_FAILED)
public class AnalysisController {
    private final AnalysisService analysis;
    private final RecommendationService recommendations;
    private final AnalysisStorage storage;

    public AnalysisController(AnalysisService analysis, RecommendationService recommendations, AnalysisStorage storage) {
        this.analysis = analysis;
        this.recommendations = recommendations;
        this.storage = storage;
    }

    @GetMapping("/latest")
    public ResponseEntity<AnalysisResult> latest(@AuthenticationPrincipal Long userId) {
        return storage.latest(userId).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/history")
    public List<AnalysisResult> history(@AuthenticationPrincipal Long userId) { return storage.history(userId); }

    @GetMapping("/history/{id}")
    public AnalysisResult historical(@AuthenticationPrincipal Long userId, @PathVariable String id) {
        return storage.historical(userId, id);
    }

    @DeleteMapping("/history/{id}")
    public ResponseEntity<Void> deleteHistory(@AuthenticationPrincipal Long userId, @PathVariable String id) {
        storage.deleteHistory(userId, id);
        return ResponseEntity.noContent().build();
    }

    @RateLimited(Operation.ANALYSIS)
    @PostMapping
    public AnalysisResult analyze(@AuthenticationPrincipal Long userId) {
        return analysis.analyze(userId);
    }

    @RateLimited(Operation.ANALYSIS)
    @PostMapping(headers = "X-Analysis-Mode=progressive")
    public AnalysisResult start(@AuthenticationPrincipal Long userId) {
        return analysis.start(userId);
    }

    @RateLimited(Operation.PROFILE)
    @PostMapping("/{id}/profile")
    public AnalysisResult profile(@AuthenticationPrincipal Long userId, @PathVariable String id) {
        return analysis.completeProfile(userId, id);
    }

    @RateLimited(Operation.RECOMMENDATIONS)
    @PostMapping("/{id}/recommendations/initial")
    public AnalysisResult recommendations(@AuthenticationPrincipal Long userId, @PathVariable String id) {
        return analysis.completeRecommendations(userId, id);
    }

    @RateLimited(Operation.RECOMMENDATIONS)
    @PostMapping("/{id}/recommendations")
    public AnalysisResult retryRecommendations(@AuthenticationPrincipal Long userId, @PathVariable String id) {
        return analysis.retryRecommendations(userId, id);
    }

    public record SavePlaylistRequest(List<String> uris, String name) {}

    @RateLimited(Operation.PLAYLIST)
    @PostMapping("/recommendations/save")
    public Map<String, String> save(@AuthenticationPrincipal Long userId, @RequestBody SavePlaylistRequest body) {
        String name = body.name() == null || body.name().isBlank() ? "추천곡 TOP5" : body.name();
        return Map.of("playlistUrl", recommendations.saveAsPlaylist(userId, name, body.uris()));
    }
}
