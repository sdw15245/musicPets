package com.example.demo.analysis;

import com.example.demo.user.User;
import jakarta.persistence.*;

/** 계정당 최신 결과 하나만 저장한다. 원본 청취 기록은 저장하지 않는다. */
@Entity
@Table(name = "latest_analyses")
public class LatestAnalysis {
    @Id
    private Long userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false)
    private String analysisId;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String resultJson;

    protected LatestAnalysis() {}
    public LatestAnalysis(User user) { this.user = user; }
    public String getAnalysisId() { return analysisId; }
    public String getResultJson() { return resultJson; }
    public void replace(String analysisId, String resultJson) {
        this.analysisId = analysisId;
        this.resultJson = resultJson;
    }
}
