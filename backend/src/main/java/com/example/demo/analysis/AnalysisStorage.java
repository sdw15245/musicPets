package com.example.demo.analysis;

import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.function.UnaryOperator;

@Service
public class AnalysisStorage {
    private final LatestAnalysisRepository results;
    private final UserRepository users;
    private final ObjectMapper mapper;
    private final AnalysisHistoryRepository history;

    public AnalysisStorage(LatestAnalysisRepository results, UserRepository users, ObjectMapper mapper, AnalysisHistoryRepository history) {
        this.results = results;
        this.users = users;
        this.mapper = mapper;
        this.history = history;
    }

    @Transactional(readOnly = true)
    public Optional<AnalysisResult> latest(Long userId) {
        return results.findById(userId).map(this::decode);
    }

    @Transactional
    public void save(Long userId, AnalysisResult result) {
        // 펫과 수집 기록을 같은 트랜잭션에 저장한다.
        User user = users.findForUpdate(userId).orElseThrow();
        includeLegacy(user);
        LatestAnalysis row = results.findById(userId).orElseGet(() -> new LatestAnalysis(user));
        row.replace(result.id(), encode(result));
        results.save(row);
        saveSnapshot(user, result.id(), row.getResultJson());
        var records = history.findByUserIdOrderByIdDesc(userId);
        if (records.size() > 10) history.deleteAll(records.subList(10, records.size()));
        user.recordAnalysis(result.character() == null ? null : result.character().slug());
    }

    @Transactional
    public AnalysisResult updateCurrent(Long userId, String id, UnaryOperator<AnalysisResult> update) {
        User user = users.findForUpdate(userId).orElseThrow();
        LatestAnalysis row = results.findById(userId).filter(r -> r.getAnalysisId().equals(id))
                .orElseThrow(AnalysisExpiredException::new);
        AnalysisResult result = update.apply(decode(row));
        row.replace(id, encode(result));
        saveSnapshot(user, id, row.getResultJson());
        return result;
    }

    @Transactional
    public java.util.List<AnalysisResult> history(Long userId) {
        includeLegacy(users.findForUpdate(userId).orElseThrow());
        return history.findByUserIdOrderByIdDesc(userId).stream().map(row -> decode(row.getResultJson())).toList();
    }

    @Transactional
    public AnalysisResult historical(Long userId, String id) {
        includeLegacy(users.findForUpdate(userId).orElseThrow());
        return decode(requireHistory(userId, id).getResultJson());
    }

    @Transactional
    public void deleteHistory(Long userId, String id) {
        includeLegacy(users.findForUpdate(userId).orElseThrow());
        history.delete(requireHistory(userId, id));
        // 삭제한 최신 결과가 다음 조회에서 다시 기록으로 복원되지 않도록 함께 지운다.
        results.findById(userId).filter(row -> row.getAnalysisId().equals(id)).ifPresent(results::delete);
    }

    private AnalysisHistory requireHistory(Long userId, String id) {
        return history.findByUserIdAndAnalysisId(userId, id).orElseThrow(() ->
            new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND));
    }

    private void includeLegacy(User user) {
        results.findById(user.getId()).ifPresent(row -> {
            if (history.findByUserIdAndAnalysisId(user.getId(), row.getAnalysisId()).isEmpty())
                history.save(new AnalysisHistory(user, row.getAnalysisId(), row.getResultJson()));
        });
    }

    private void saveSnapshot(User user, String id, String json) {
        var snapshot = history.findByUserIdAndAnalysisId(user.getId(), id)
                .orElseGet(() -> new AnalysisHistory(user, id, json));
        snapshot.replace(json);
        history.save(snapshot);
    }

    private AnalysisResult decode(LatestAnalysis row) {
        return decode(row.getResultJson());
    }
    private AnalysisResult decode(String json) {
        try { return mapper.readValue(json, AnalysisResult.class); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot read stored analysis", e); }
    }

    private String encode(AnalysisResult result) {
        try { return mapper.writeValueAsString(result); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot store analysis", e); }
    }
}
