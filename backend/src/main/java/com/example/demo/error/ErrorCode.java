package com.example.demo.error;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

/**
 * API 오류 응답의 error 값과 HTTP 상태를 정하는 유일한 표.
 * 프론트는 error 값으로 분기하므로 이름을 바꾸면 프론트도 함께 바꿔야 한다.
 */
public enum ErrorCode {
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 형식을 확인해주세요."),
    INVALID_PLAYLIST(HttpStatus.BAD_REQUEST, "저장할 Spotify 곡을 선택해주세요."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."),
    SESSION_EXPIRED(HttpStatus.UNAUTHORIZED, "다시 로그인해주세요."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "접근 권한이 없어요."),
    CSRF_INVALID(HttpStatus.FORBIDDEN, "요청을 확인하지 못했어요. 다시 시도해주세요."),
    // 401은 우리 JWT 갱신용이므로 Spotify 재인증은 별도 코드의 403으로 전달한다.
    SPOTIFY_REAUTH_REQUIRED(HttpStatus.FORBIDDEN, "Spotify 연결이 만료되었거나 해제됐어요. Spotify에 다시 연결해주세요."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 정보를 찾을 수 없어요."),
    ANALYSIS_EXPIRED(HttpStatus.CONFLICT, "분석 보관 시간이 지났어요. 다시 분석해주세요."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요."),
    ANALYSIS_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "분석 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."),
    EXTERNAL_SERVICE_FAILED(HttpStatus.BAD_GATEWAY, "음악 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요."),
    AUTH_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.");

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus status() { return status; }
    public String message() { return message; }

    /** Spring MVC가 상태 코드만 정한 오류(404 경로, 405 메서드 등)에 붙일 코드. */
    static ErrorCode forStatus(HttpStatusCode status) {
        return switch (status.value()) {
            case 401 -> UNAUTHORIZED;
            case 403 -> FORBIDDEN;
            case 404 -> NOT_FOUND;
            default -> status.is5xxServerError() ? INTERNAL_ERROR : INVALID_REQUEST;
        };
    }
}
