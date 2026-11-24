package com.example.demo.analysis;

import com.example.demo.concurrency.SingleFlight;
import com.example.demo.genre.UserVectorService;
import com.example.demo.lastfm.LastfmService;
import com.example.demo.lastfm.LastfmTag;
import com.example.demo.matching.MatchService;
import com.example.demo.recommendation.RecommendationService;
import com.example.demo.recommendation.RecommendationService.RecommendedArtist;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.spotify.SpotifyReauthorizationRequiredException;
import com.example.demo.spotify.SpotifyLimitException;
import com.example.demo.spotify.SpotifyService.TopTrack;
import com.example.demo.taste.TasteCommentService;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestClientException;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

/**
 * 분석 흐름 조율: 펫 매칭(핵심) → AI 해설·추천 아티스트(선택).
 * 선택 단계는 공유 시간 예산 안에서만 기다리고, 실패해도 핵심 결과는 저장한다.
 */
@Service
public class AnalysisService {
    private static final Logger log = LoggerFactory.getLogger(AnalysisService.class);
    // t3.small(2 vCPU)에서 parallelStream이 내던 동시성과 같다. Last.fm 요청 속도를 올리지 않는다.
    private static final int TAG_LOOKUP_CONCURRENCY = 2;
    private final SpotifyService spotify;
    private final LastfmService lastfm;
    private final UserVectorService vectors;
    private final MatchService matches;
    private final TasteCommentService taste;
    private final RecommendationService recommendations;
    private final AnalysisStorage storage;
    private final RecentTracks recentTracks = new RecentTracks(Duration.ofMinutes(10), 100, Clock.systemUTC());
    private record Work(Long userId, String analysisId, String stage) {}
    private final SingleFlight<Work, AnalysisResult> runs = new SingleFlight<>();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    @Value("${analysis.optional-timeout-ms:45000}")
    private long optionalTimeoutMs = 45_000;

    private record Matched(AnalysisResult result, List<TopTrack> tracks) {}
    private record ProfileOutcome(AnalysisResult.Profile profile, List<String> warnings) {
        AnalysisResult applyTo(AnalysisResult result) { return result.withProfile(profile, warnings); }
    }

    public AnalysisService(SpotifyService spotify, LastfmService lastfm, UserVectorService vectors,
                           MatchService matches, TasteCommentService taste, RecommendationService recommendations, AnalysisStorage storage) {
        this.spotify = spotify;
        this.lastfm = lastfm;
        this.vectors = vectors;
        this.matches = matches;
        this.taste = taste;
        this.recommendations = recommendations;
        this.storage = storage;
    }

    /** 기본 요청은 기존처럼 완성된 결과를 반환한다. */
    public AnalysisResult analyze(Long userId) {
        return run(userId, false);
    }

    public AnalysisResult start(Long userId) {
        return run(userId, true);
    }

    private AnalysisResult run(Long userId, boolean progressive) {
        return runs.run(new Work(userId, "", progressive ? "start" : "full"), () -> {
            String id = UUID.randomUUID().toString();
            return timed(id, progressive ? "core" : "total", () -> {
                Matched matched = matchPet(userId, id);
                AnalysisResult result = matched.result();
                if (!progressive) {
                    long deadline = deadline();
                    var profile = startProfile(result, matched.tracks());
                    var artists = startRecommendations(userId, id, matched.tracks());
                    result = finishProfile(id, profile, deadline).applyTo(result);
                    result = finishRecommendations(result, artists, deadline);
                }
                storage.save(userId, result);
                recentTracks.put(userId, id, result.analyzedAt(), matched.tracks());
                return result;
            });
        });
    }

    private Matched matchPet(Long userId, String id) {
        List<TopTrack> recentTracks = timed(id, "spotify_top_tracks",
                () -> List.copyOf(spotify.getTopTracks(userId, 20)));
        boolean useSixMonths = recentTracks.isEmpty();
        List<TopTrack> tracks = useSixMonths
                ? timed(id, "spotify_top_tracks_fallback",
                    () -> List.copyOf(spotify.getTopTracks(userId, 20, "medium_term")))
                : recentTracks;
        String timeRange = useSixMonths ? "medium_term" : SpotifyService.TOP_TRACK_TIME_RANGE;
        List<String> warnings = useSixMonths && !tracks.isEmpty()
                ? List.of("최근 4주 청취곡이 없어 최근 6개월 기록으로 분석했어요.") : List.of();
        List<List<LastfmTag>> tags = timed(id, "lastfm_tags", () -> trackTags(tracks));
        UserVectorService.Result vector = timed(id, "genre_normalization", () -> vectors.build(tags));
        var match = timed(id, "character_match", () -> matches.findTop1(vector.vector()));
        var character = match == null ? null : new AnalysisResult.MatchedCharacter(
                match.character().slug(), match.character().name(), match.character().description(),
                match.character().imageUrl(), match.score());
        var genres = new AnalysisResult.Genres(vector.vector(), vector.unmappedTags(),
                tags.stream().mapToInt(List::size).sum(), tracks.size(), timeRange);
        return new Matched(AnalysisResult.pending(id, Instant.now(), genres, character, warnings), tracks);
    }

    /** 곡 순서대로 태그를 돌려준다. 하나라도 실패하면 남은 조회를 취소하고 그 예외를 그대로 던진다. */
    private List<List<LastfmTag>> trackTags(List<TopTrack> tracks) {
        Semaphore slots = new Semaphore(TAG_LOOKUP_CONCURRENCY);
        List<Future<List<LastfmTag>>> lookups = tracks.stream()
                .map(track -> executor.submit(limited(slots, () -> lastfm.getTrackTags(track.artist(), track.name()))))
                .toList();
        try {
            List<List<LastfmTag>> tags = new ArrayList<>(lookups.size());
            for (var lookup : lookups) tags.add(join(lookup));
            return tags;
        } finally {
            lookups.forEach(lookup -> lookup.cancel(true));
        }
    }

    private static <T> Callable<T> limited(Semaphore slots, Supplier<T> work) {
        return () -> {
            slots.acquire();
            try {
                return work.get();
            } finally {
                slots.release();
            }
        };
    }

    public AnalysisResult completeProfile(Long userId, String id) {
        return runs.run(new Work(userId, id, "profile"), () -> {
            AnalysisResult current = latest(userId, id);
            if (!current.profilePending()) return current;
            // 원본 트랙이 만료되어도 저장된 장르 비중만으로 AI 코멘트를 생성할 수 있다.
            var tracks = seeds(userId, id).orElse(List.of());
            ProfileOutcome finished = finishProfile(id, startProfile(current, tracks), deadline());
            return storage.updateCurrent(userId, id, saved -> saved.profilePending() ? finished.applyTo(saved) : saved);
        });
    }

    public AnalysisResult completeRecommendations(Long userId, String id) {
        return runs.run(new Work(userId, id, "recommendations"), () -> {
            AnalysisResult current = latest(userId, id);
            if (!current.recommendationsPending()) return current;
            AnalysisResult finished = seeds(userId, id)
                    .map(tracks -> finishRecommendations(current, startRecommendations(userId, id, tracks), deadline()))
                    .orElseGet(() -> current.withArtistRecommendations(List.of(), false, null));
            return storage.updateCurrent(userId, id, saved -> saved.recommendationsPending()
                    ? saved.withArtistRecommendations(finished.recommendedArtists(), finished.recommendationsAvailable(),
                            finished.recommendationLimit()) : saved);
        });
    }

    public AnalysisResult retryRecommendations(Long userId, String analysisId) {
        return runs.run(new Work(userId, analysisId, "retry"), () -> {
            var tracks = seeds(userId, analysisId).orElseThrow(AnalysisExpiredException::new);
            var artists = await(startRecommendations(userId, analysisId, tracks), deadline());
            return storage.updateCurrent(userId, analysisId, saved -> saved.withArtistRecommendations(artists));
        });
    }

    private AnalysisResult latest(Long userId, String id) {
        return storage.latest(userId).filter(result -> result.id().equals(id)).orElseThrow(AnalysisExpiredException::new);
    }

    private Optional<List<TopTrack>> seeds(Long userId, String id) {
        var tracks = recentTracks.find(userId, id);
        if (tracks.isPresent()) return tracks;
        // 다른 탭이 저장 직후 latest를 읽었다면 트랙 보관까지 기다린다.
        runs.awaitIfRunning(new Work(userId, "", "start"));
        return recentTracks.find(userId, id);
    }

    private long deadline() {
        return System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(optionalTimeoutMs);
    }

    private Future<ProfileOutcome> startProfile(AnalysisResult result, List<TopTrack> tracks) {
        String id = result.id();
        return executor.submit(() -> timed(id, "profile",
                () -> buildProfile(id, tracks, result.genres().vector(),
                        result.character() == null ? null : result.character().slug())));
    }

    private Future<List<RecommendedArtist>> startRecommendations(Long userId, String analysisId, List<TopTrack> tracks) {
        return executor.submit(() -> timed(analysisId, "recommendations",
                () -> recommendations.recommendArtists(userId, tracks)));
    }

    private ProfileOutcome finishProfile(String id, Future<ProfileOutcome> task, long deadline) {
        try {
            return await(task, deadline);
        } catch (RuntimeException e) {
            logOptionalTimeout(id, "profile", e);
            return missingProfile();
        }
    }

    private ProfileOutcome missingProfile() {
        return new ProfileOutcome(new AnalysisResult.Profile(null, null,
                "취향 설명을 불러오지 못했어요. 장르 분포와 음악 펫을 먼저 확인해주세요."),
                List.of("취향 설명과 대중성 정보를 일부 가져오지 못했어요."));
    }

    private AnalysisResult finishRecommendations(AnalysisResult result, Future<List<RecommendedArtist>> task, long deadline) {
        try {
            return result.withArtistRecommendations(await(task, deadline));
        } catch (SpotifyReauthorizationRequiredException e) {
            throw e;
        } catch (SpotifyLimitException e) {
            return result.withArtistRecommendations(List.of(), false, e.limit());
        } catch (RuntimeException e) {
            logOptionalTimeout(result.id(), "recommendations", e);
            return result.withArtistRecommendations(List.of(), false, null);
        }
    }

    private ProfileOutcome buildProfile(String runId, List<TopTrack> tracks, Map<String, Double> vector, String matchedSlug) {
        List<Long> listeners = new ArrayList<>();
        long started = System.nanoTime();
        String outcome = "failed";
        try {
            for (TopTrack track : tracks) {
                if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Profile cancelled");
                try {
                    listeners.add(lastfm.getTrackListeners(track.artist(), track.name()));
                } catch (RuntimeException e) {
                    // 일부 실패/미등록 곡은 대중성 평균에서 제외한다.
                }
            }
            outcome = listeners.stream().filter(count -> count > 0).count() < tracks.size() ? "partial" : "completed";
        } finally {
            logTiming(runId, "lastfm_listeners", outcome, started);
        }
        if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Profile cancelled");
        Popularity popularity = Popularity.estimate(tracks.size(), listeners);
        Double mainstream = popularity.mainstream();
        return new ProfileOutcome(new AnalysisResult.Profile(mainstream, mainstream == null ? null : 100 - mainstream,
                timed(runId, "taste_comment", () -> taste.comment(vector, mainstream, matchedSlug))), popularity.warnings());
    }

    // 실제 작업 스레드에서 측정하므로 병렬 작업의 완료 대기 시간이 중복 합산되지 않는다.
    private <T> T timed(String runId, String stage, Supplier<T> operation) {
        long started = System.nanoTime();
        String outcome = "failed";
        try {
            T result = operation.get();
            outcome = "completed";
            return result;
        } finally {
            logTiming(runId, stage, outcome, started);
        }
    }

    private void logTiming(String runId, String stage, String outcome, long started) {
        log.info("analysis_timing run_id={} stage={} outcome={} elapsed_ms={}",
                runId, stage, Thread.currentThread().isInterrupted() ? "cancelled" : outcome,
                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
    }

    private void logOptionalTimeout(String runId, String stage, RuntimeException error) {
        if (error.getCause() instanceof TimeoutException) {
            log.info("analysis_timeout run_id={} stage={} shared_budget_ms={}", runId, stage, optionalTimeoutMs);
        }
    }

    /** 공유 시간 예산 안에서 기다린다. 시간이 지나면 작업을 취소하고 외부 서비스 실패로 알린다. */
    private static <T> T await(Future<T> task, long deadline) {
        try {
            return task.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Analysis interrupted", e);
        } catch (ExecutionException e) {
            throw unwrap(e);
        } catch (TimeoutException e) {
            throw new RestClientException("Optional analysis timed out", e);
        } finally {
            if (!task.isDone()) task.cancel(true);
        }
    }

    private static <T> T join(Future<T> task) {
        try {
            return task.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Analysis interrupted", e);
        } catch (ExecutionException e) {
            throw unwrap(e);
        }
    }

    /** 작업 스레드에서 난 예외를 원래 타입 그대로 호출자에게 돌려준다(Spotify 재인증·사용량 제한 포함). */
    private static RuntimeException unwrap(ExecutionException e) {
        if (e.getCause() instanceof RuntimeException cause) return cause;
        if (e.getCause() instanceof Error error) throw error;
        return new IllegalStateException("Analysis step failed", e.getCause());
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
