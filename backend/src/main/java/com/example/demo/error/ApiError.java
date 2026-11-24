package com.example.demo.error;

/** 모든 오류 응답 본문. 프론트는 error로 분기하고 message를 그대로 보여준다. */
public record ApiError(String error, String message) {
    public static ApiError of(ErrorCode code) {
        return of(code, code.message());
    }

    public static ApiError of(ErrorCode code, String message) {
        return new ApiError(code.name(), message);
    }
}
