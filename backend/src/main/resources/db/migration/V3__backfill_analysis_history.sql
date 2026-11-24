-- 분석 기록 기능 이전에 저장된 최신 결과를 기록으로 한 번 옮긴다.
-- 이전에는 기록을 조회할 때마다 사용자 행을 잠그고 옮겼다(AnalysisStorage.includeLegacy).
INSERT INTO analysis_history (user_id, analysis_id, result_json)
SELECT l.user_id, l.analysis_id, l.result_json
FROM latest_analyses l
WHERE NOT EXISTS (
    SELECT 1 FROM analysis_history h
    WHERE h.user_id = l.user_id AND h.analysis_id = l.analysis_id
);
