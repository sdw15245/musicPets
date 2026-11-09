package com.example.demo.analysis;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AnalysisHistoryRepository extends JpaRepository<AnalysisHistory, Long> {
    List<AnalysisHistory> findByUserIdOrderByIdDesc(Long userId);
    Optional<AnalysisHistory> findByUserIdAndAnalysisId(Long userId, String analysisId);
}
