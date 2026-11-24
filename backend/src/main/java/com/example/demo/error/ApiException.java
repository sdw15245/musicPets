package com.example.demo.error;

/**
 * 서비스가 HTTP 타입에 기대지 않고 요청 실패를 알린다.
 * 상태 코드는 ErrorCode가, 응답 형태는 ApiExceptionHandler가 정한다.
 */
public class ApiException extends RuntimeException {
    private final ErrorCode code;

    public ApiException(ErrorCode code) {
        this(code, code.message());
    }

    public ApiException(ErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public ErrorCode code() { return code; }
}
