package com.example.demo.analysis;

import com.example.demo.user.User;
import jakarta.persistence.*;

@Entity
@Table(name = "analysis_history", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "analysis_id"}),
       indexes = @Index(name = "idx_history_user_id", columnList = "user_id,id"))
public class AnalysisHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id") private User user;
    @Column(name = "analysis_id", nullable = false) private String analysisId;
    @Lob @Column(nullable = false, columnDefinition = "LONGTEXT") private String resultJson;
    protected AnalysisHistory() {}
    public AnalysisHistory(User user, String analysisId, String json) {
        this.user = user; this.analysisId = analysisId; this.resultJson = json;
    }
    public Long getId() { return id; }
    public String getAnalysisId() { return analysisId; }
    public String getResultJson() { return resultJson; }
    public void replace(String json) { resultJson = json; }
}
