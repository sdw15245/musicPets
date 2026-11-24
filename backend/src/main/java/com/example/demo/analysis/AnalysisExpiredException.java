package com.example.demo.analysis;

import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;

public class AnalysisExpiredException extends ApiException {
    public AnalysisExpiredException() {
        super(ErrorCode.ANALYSIS_EXPIRED);
    }
}
