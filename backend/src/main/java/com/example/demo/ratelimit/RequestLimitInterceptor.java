package com.example.demo.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 컨트롤러가 정해진 /api 요청에 요청 예산을 적용한다(인증 경로 제외, RequestLimitConfig).
 * Spring Security 다음에 실행되므로 로그인이 필요한 요청은 이미 401로 끝났고,
 * 여기까지 온 비로그인 요청은 공개 조회뿐이다. 이들은 접속 주소 예산만 쓴다.
 * 초과하면 RequestLimitException을 던지고 ApiExceptionHandler가 429로 응답한다.
 */
class RequestLimitInterceptor implements HandlerInterceptor {
    private static final String PERMIT = RequestLimitInterceptor.class.getName() + ".permit";
    private final RequestGuard guard;

    RequestLimitInterceptor(RequestGuard guard) {
        this.guard = guard;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod method)) return true;
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        Long user = authentication != null && authentication.getPrincipal() instanceof Long id ? id : null;
        // 전달 헤더는 신뢰하지 않는다. 운영에서는 Nginx가 덮어쓴 값을 Tomcat이 원격 주소로 반영한다.
        request.setAttribute(PERMIT, guard.acquire(operation(method, request.getMethod()), user, request.getRemoteAddr()));
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (request.getAttribute(PERMIT) instanceof RequestGuard.Permit permit) permit.close();
    }

    static RequestLimits.Operation operation(HandlerMethod method, String httpMethod) {
        RateLimited declared = method.getMethodAnnotation(RateLimited.class);
        if (declared != null) return declared.value();
        return "GET".equals(httpMethod) || "HEAD".equals(httpMethod)
                ? RequestLimits.Operation.READ : RequestLimits.Operation.WRITE;
    }
}
