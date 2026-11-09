package com.example.demo.analysis;

public class AnalysisExpiredException extends RuntimeException {
    public AnalysisExpiredException() {
        super("분석 보관 시간이 지났어요. 다시 분석해주세요.");
    }
}
