package com.example.demo.analysis;

import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.function.UnaryOperator;

@Service
public class AnalysisStorage {
    private final LatestAnalysisRepository results;
    private final UserRepository users;
    private final StoredAnalysisJson format;
    private final AnalysisHistoryRepository history;

    public AnalysisStorage(LatestAnalysisRepository results, UserRepository users, ObjectMapper mapper, AnalysisHistoryRepository history) {
        this.results = results;
        this.users = users;
        this.format = new StoredAnalysisJson(mapper);
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

    // 최신 결과는 저장할 때 항상 기록에도 남는다. 그 이전 데이터는 V3 마이그레이션이 옮겼다.
    @Transactional(readOnly = true)
    public java.util.List<AnalysisResult> history(Long userId) {
        return history.findByUserIdOrderByIdDesc(userId).stream().map(row -> decode(row.getResultJson())).toList();
    }

    @Transactional(readOnly = true)
    public AnalysisResult historical(Long userId, String id) {
        return decode(requireHistory(userId, id).getResultJson());
    }

    @Transactional
    public void deleteHistory(Long userId, String id) {
        // 저장·갱신과 같은 사용자 잠금을 써서 진행 중인 분석 갱신과 엇갈리지 않게 한다.
        users.findForUpdate(userId).orElseThrow();
        history.delete(requireHistory(userId, id));
        // 기록에서 지운 결과가 최신 결과 화면에 남지 않도록 함께 지운다.
        results.findById(userId).filter(row -> row.getAnalysisId().equals(id)).ifPresent(results::delete);
    }

    private AnalysisHistory requireHistory(Long userId, String id) {
        return history.findByUserIdAndAnalysisId(userId, id).orElseThrow(() ->
            new ApiException(ErrorCode.NOT_FOUND, "분석 기록을 찾을 수 없어요."));
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
        return format.read(json);
    }

    private String encode(AnalysisResult result) {
        return format.write(result);
    }
}
