package com.example.demo.error;

import com.example.demo.ratelimit.RequestLimitException;
import com.example.demo.spotify.SpotifyLimitException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.Arrays;
import java.util.List;

/**
 * 모든 컨트롤러의 오류를 {error, message} 형태로 바꾼다.
 * 응답을 여기서 끝내므로 Tomcat의 /error 재전달(인증 없이 처리되어 401이 되던 경로)을 거치지 않는다.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> api(ApiException e) {
        return respond(e.code(), e.getMessage());
    }

    @ExceptionHandler(SpotifyLimitException.class)
    public ResponseEntity<SpotifyLimitException.Limit> spotifyLimit(SpotifyLimitException e) {
        return tooManyRequests(e.limit().retryAfterSeconds(), e.limit());
    }

    @ExceptionHandler(RequestLimitException.class)
    public ResponseEntity<RequestLimitException.Limit> requestLimit(RequestLimitException e) {
        return tooManyRequests(e.limit().retryAfterSeconds(), e.limit());
    }

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<ApiError> externalFailure(RestClientException e) {
        // 응답 본문·URL·예외 메시지에는 토큰이 포함될 수 있어 유형과 상태만 남긴다.
        log.warn("external_request_failed type={} status={} at={}", e.getClass().getSimpleName(),
                e instanceof RestClientResponseException response ? response.getStatusCode().value() : null,
                applicationFrames(e));
        return respond(ErrorCode.EXTERNAL_SERVICE_FAILED, ErrorCode.EXTERNAL_SERVICE_FAILED.message());
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiError> unexpected(RuntimeException e, HandlerMethod handler) {
        ErrorCode code = fallback(handler);
        log.error("request_failed code={} type={} at={}", code, e.getClass().getSimpleName(), applicationFrames(e));
        return respond(code, code.message());
    }

    /** Spring MVC가 직접 판단한 오류(없는 경로, 읽을 수 없는 본문, 잘못된 파라미터 등). */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception e, @Nullable Object body, HttpHeaders headers,
                                                             HttpStatusCode status, WebRequest request) {
        ErrorCode code = ErrorCode.forStatus(status);
        // Spring 기본 문구는 영어 내부 설명이라 노출하지 않는다. 직접 지정한 사유만 전달한다.
        String message = e instanceof ResponseStatusException explicit && explicit.getReason() != null
                ? explicit.getReason() : code.message();
        return super.handleExceptionInternal(e, ApiError.of(code, message), headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> createResponseEntity(@Nullable Object body, HttpHeaders headers,
                                                          HttpStatusCode status, WebRequest request) {
        HttpHeaders copy = new HttpHeaders();
        copy.putAll(headers);
        copy.setCacheControl(CacheControl.noStore());
        return new ResponseEntity<>(body, copy, status);
    }

    /** 대기 시간을 담은 본문(error, message, retryAfterSeconds, retryAt …)을 그대로 보낸다. */
    private static <T> ResponseEntity<T> tooManyRequests(long retryAfterSeconds, T limit) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds))
                .body(limit);
    }

    private static ResponseEntity<ApiError> respond(ErrorCode code, String message) {
        return ResponseEntity.status(code.status()).cacheControl(CacheControl.noStore()).body(ApiError.of(code, message));
    }

    private static ErrorCode fallback(HandlerMethod handler) {
        FallbackError declared = AnnotatedElementUtils.findMergedAnnotation(handler.getBeanType(), FallbackError.class);
        return declared == null ? ErrorCode.INTERNAL_ERROR : declared.value();
    }

    private static List<StackTraceElement> applicationFrames(Exception e) {
        return Arrays.stream(e.getStackTrace())
                .filter(frame -> frame.getClassName().startsWith("com.example.demo."))
                .limit(8).toList();
    }
}
