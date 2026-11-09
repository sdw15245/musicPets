package com.example.demo.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import static com.example.demo.ratelimit.RequestLimits.Operation;

/** Added only to the security chain, after JWT authentication (not a servlet filter bean). */
public class RequestLimitFilter extends OncePerRequestFilter {
    private final RequestGuard guard;
    private final ObjectMapper mapper;
    public RequestLimitFilter(RequestGuard guard, ObjectMapper mapper) { this.guard = guard; this.mapper = mapper; }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String method = request.getMethod();
        if (!path.startsWith("/api/") || path.startsWith("/api/auth/") || "OPTIONS".equals(method)) {
            chain.doFilter(request, response); return;
        }
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        Long user = authentication != null && authentication.isAuthenticated() && authentication.getPrincipal() instanceof Long id ? id : null;
        boolean publicRead = "GET".equals(method) && (path.equals("/api/posts") || path.matches("/api/posts/[0-9]+(?:/comments)?"));
        if (user == null && !publicRead) { chain.doFilter(request, response); return; } // Keep protected requests as 401.
        Operation operation = classify(method, path);
        RequestGuard.Permit permit;
        try { permit = guard.acquire(operation, user, request.getRemoteAddr()); }
        catch (RequestLimitException error) {
            response.setStatus(429);
            response.setCharacterEncoding("UTF-8");
            response.setContentType("application/json");
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Retry-After", Long.toString(error.limit().retryAfterSeconds()));
            mapper.writeValue(response.getWriter(), error.limit());
            return;
        }
        try (permit) { chain.doFilter(request, response); }
    }

    static Operation classify(String method, String path) {
        if ("POST".equals(method)) {
            if (path.equals("/api/analysis")) return Operation.ANALYSIS;
            if (path.equals("/api/analysis/recommendations/save")) return Operation.PLAYLIST;
            if (path.matches("/api/analysis/[^/]+/profile")) return Operation.PROFILE;
            if (path.matches("/api/analysis/[^/]+/recommendations(?:/initial)?")) return Operation.RECOMMENDATIONS;
        }
        if ("GET".equals(method) && path.equals("/api/tracks/search")) return Operation.SEARCH;
        return "GET".equals(method) || "HEAD".equals(method) ? Operation.READ : Operation.WRITE;
    }
}
