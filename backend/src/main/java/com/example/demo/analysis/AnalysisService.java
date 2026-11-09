package com.example.demo.analysis;

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

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;

@Service
public class AnalysisService {
    private static final Logger log = LoggerFactory.getLogger(AnalysisService.class);
    static final String RECOMMENDATIONS_WARNING = "추천 아티스트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private static final int MAX_CACHED_USERS = 100;
    private final SpotifyService spotify;
    private final LastfmService lastfm;
    private final UserVectorService vectors;
    private final MatchService matches;
    private final TasteCommentService taste;
    private final RecommendationService recommendations;
    private final AnalysisStorage storage;
    private final Map<Long, CachedAnalysis> cache = new LinkedHashMap<>();
    private record Work(Long userId, String analysisId, String stage) {}
    private final ConcurrentHashMap<Work, CompletableFuture<AnalysisResult>> inFlight = new ConcurrentHashMap<>();
    private final ExecutorService optionalExecutor = Executors.newVirtualThreadPerTaskExecutor();
    @Value("${analysis.optional-timeout-ms:45000}")
    private long optionalTimeoutMs = 45_000;

    private record CachedAnalysis(AnalysisResult result, List<TopTrack> tracks) {}
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
        return once(new Work(userId, "", progressive ? "start" : "full"), () -> {
            String id = UUID.randomUUID().toString();
            return timed(id, progressive ? "core" : "total", () -> {
                CachedAnalysis core = matchPet(userId, id);
                AnalysisResult result = core.result();
                if (!progressive) {
                    long deadline = deadline();
                    var profile = startProfile(result, core.tracks());
                    var songs = startRecommendations(userId, core);
                    result = finishProfile(id, profile, deadline).applyTo(result);
                    result = finishRecommendations(result, songs, deadline);
                }
                storage.save(userId, result);
                synchronized (cache) {
                    cache.put(userId, new CachedAnalysis(result, core.tracks()));
                    while (cache.size() > MAX_CACHED_USERS) cache.remove(cache.keySet().iterator().next());
                }
                return result;
            });
        });
    }

    private CachedAnalysis matchPet(Long userId, String id) {
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
        List<List<LastfmTag>> tags = timed(id, "lastfm_tags", () -> tracks.parallelStream()
                .map(t -> lastfm.getTrackTags(t.artist(), t.name())).toList());
        UserVectorService.Result vector = timed(id, "genre_normalization", () -> vectors.build(tags));
        var match = timed(id, "character_match", () -> matches.findTop1(vector.vector()));
        var character = match == null ? null : new AnalysisResult.MatchedCharacter(
                match.character().slug(), match.character().name(), match.character().description(),
                match.character().imageUrl(), match.score());
        var genres = new AnalysisResult.Genres(vector.vector(), vector.unmappedTags(),
                tags.stream().mapToInt(List::size).sum(), tracks.size(), timeRange);
        return new CachedAnalysis(new AnalysisResult(id, Instant.now(), genres, character,
                new AnalysisResult.Profile(null, null, ""), List.of(), false, warnings, null, true, true, List.of()), tracks);
    }

    public AnalysisResult completeProfile(Long userId, String id) {
        return once(new Work(userId, id, "profile"), () -> {
            AnalysisResult current = latest(userId, id);
            if (!current.profilePending()) return current;
            CachedAnalysis core = seeds(userId, id);
            // 원본 트랙이 만료되어도 저장된 장르 비중만으로 AI 코멘트를 생성할 수 있다.
            var tracks = core == null ? List.<TopTrack>of() : core.tracks();
            ProfileOutcome finished = finishProfile(id, startProfile(current, tracks), deadline());
            return storage.updateCurrent(userId, id, saved -> saved.profilePending() ? finished.applyTo(saved) : saved);
        });
    }

    public AnalysisResult completeRecommendations(Long userId, String id) {
        return once(new Work(userId, id, "recommendations"), () -> {
            AnalysisResult current = latest(userId, id);
            if (!current.recommendationsPending()) return current;
            CachedAnalysis core = seeds(userId, id);
            AnalysisResult finished = core == null ? current.withArtistRecommendations(List.of(), false, null) :
                    finishRecommendations(current, startRecommendations(userId, core), deadline());
            return storage.updateCurrent(userId, id, saved -> saved.recommendationsPending()
                    ? saved.withArtistRecommendations(finished.recommendedArtists(), finished.recommendationsAvailable(),
                            finished.recommendationLimit()) : saved);
        });
    }

    private AnalysisResult latest(Long userId, String id) {
        return storage.latest(userId).filter(result -> result.id().equals(id)).orElseThrow(AnalysisExpiredException::new);
    }

    private CachedAnalysis seeds(Long userId, String id) {
        CachedAnalysis entry = cached(userId);
        if (entry == null || !entry.result().id().equals(id)) {
            // 다른 탭이 저장 직후 latest를 읽었다면 트랙 캐시 등록까지 기다린다.
            var starting = inFlight.get(new Work(userId, "", "start"));
            if (starting != null) {
                starting.join();
                entry = cached(userId);
            }
        }
        return entry != null && entry.result().id().equals(id) ? entry : null;
    }

    private long deadline() {
        return System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(optionalTimeoutMs);
    }

    private Future<ProfileOutcome> startProfile(AnalysisResult result, List<TopTrack> tracks) {
        String id = result.id();
        return optionalExecutor.submit(() -> timed(id, "profile",
                () -> buildProfile(id, tracks, result.genres().vector(),
                        result.character() == null ? null : result.character().slug())));
    }

    private Future<List<RecommendedArtist>> startRecommendations(Long userId, CachedAnalysis core) {
        return optionalExecutor.submit(() -> timed(core.result().id(), "recommendations",
                () -> recommendations.recommendArtists(userId, core.tracks())));
    }

    private ProfileOutcome finishProfile(String id, Future<ProfileOutcome> task, long deadline) {
        try {
            return awaitOptional(task, deadline);
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
            return result.withArtistRecommendations(awaitOptional(task, deadline));
        } catch (SpotifyReauthorizationRequiredException e) {
            throw e;
        } catch (SpotifyLimitException e) {
            return result.withArtistRecommendations(List.of(), false, e.limit());
        } catch (RuntimeException e) {
            logOptionalTimeout(result.id(), "recommendations", e);
            return result.withArtistRecommendations(List.of(), false, null);
        }
    }

    public AnalysisResult retryRecommendations(Long userId, String analysisId) {
        CachedAnalysis core = seeds(userId, analysisId);
        if (core == null) throw new AnalysisExpiredException();
        var tracks = awaitOptional(startRecommendations(userId, core), deadline());
        return storage.updateCurrent(userId, analysisId, saved -> saved.withArtistRecommendations(tracks));
    }

    private AnalysisResult once(Work work, Supplier<AnalysisResult> action) {
        CompletableFuture<AnalysisResult> pending = new CompletableFuture<>();
        var running = inFlight.putIfAbsent(work, pending);
        if (running != null) {
            try { return running.join(); }
            catch (CompletionException e) {
                if (e.getCause() instanceof RuntimeException cause) throw cause;
                throw e;
            }
        }
        try {
            AnalysisResult result = action.get();
            pending.complete(result);
            return result;
        } catch (RuntimeException | Error e) {
            pending.completeExceptionally(e);
            throw e;
        } finally {
            inFlight.remove(work, pending);
        }
    }

    private CachedAnalysis cached(Long userId) {
        synchronized (cache) {
            cache.entrySet().removeIf(e -> e.getValue().result().analyzedAt().plus(CACHE_TTL).isBefore(Instant.now()));
            return cache.get(userId);
        }
    }

    private ProfileOutcome buildProfile(String runId, List<TopTrack> tracks, Map<String, Double> vector, String matchedSlug) {
        double sum = 0;
        int counted = 0;
        long started = System.nanoTime();
        String outcome = "failed";
        try {
            for (TopTrack track : tracks) {
                if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Profile cancelled");
                try {
                    long listeners = lastfm.getTrackListeners(track.artist(), track.name());
                    if (listeners <= 0) continue;
                    sum += Math.max(0, Math.min(1, (Math.log10(listeners) - 2) / 5)) * 100;
                    counted++;
                } catch (RuntimeException e) {
                    // 일부 실패/미등록 곡은 대중성 평균에서 제외한다.
                }
            }
            outcome = counted < tracks.size() ? "partial" : "completed";
        } finally {
            logTiming(runId, "lastfm_listeners", outcome, started);
        }
        Double mainstream = counted == 0 ? null : sum / counted;
        if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Profile cancelled");
        List<String> warnings = counted >= tracks.size() ? List.of() : List.of(counted == 0
                ? "분석한 %d곡 모두 Last.fm 청취자 수를 확인하지 못해 대중성을 계산하지 않았어요.".formatted(tracks.size())
                : "분석한 %d곡 중 %d곡의 Last.fm 청취자 수를 확인했어요. 대중성은 이 %d곡으로 계산했어요."
                    .formatted(tracks.size(), counted, counted));
        return new ProfileOutcome(new AnalysisResult.Profile(mainstream, mainstream == null ? null : 100 - mainstream,
                timed(runId, "taste_comment", () -> taste.comment(vector, mainstream, matchedSlug))), warnings);
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

    private <T> T awaitOptional(Future<T> task, long deadline) {
        try {
            return task.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Analysis interrupted", e);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof SpotifyLimitException limit) throw limit;
            if (e.getCause() instanceof SpotifyReauthorizationRequiredException reauthorization) {
                throw reauthorization;
            }
            if (e.getCause() instanceof RuntimeException cause) throw cause;
            throw new IllegalStateException("Optional analysis unavailable", e);
        } catch (TimeoutException e) {
            throw new RestClientException("Optional analysis timed out", e);
        } finally {
            if (!task.isDone()) task.cancel(true);
        }
    }

    @PreDestroy
    void shutdown() {
        optionalExecutor.shutdownNow();
    }
}
