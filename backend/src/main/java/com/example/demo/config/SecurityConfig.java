package com.example.demo.config;

import com.example.demo.auth.OAuth2LoginSuccessHandler;
import com.example.demo.auth.OAuth2LoginFailureHandler;
import com.example.demo.auth.SpotifyAuthorizationRequestResolver;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import com.example.demo.jwt.JwtAuthenticationEntryPoint;
import com.example.demo.jwt.JwtAuthenticationFilter;
import com.example.demo.ratelimit.RequestGuard;
import com.example.demo.ratelimit.RequestLimitFilter;
import com.example.demo.ratelimit.RequestLimits;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import org.springframework.http.HttpMethod;

@Configuration
@EnableConfigurationProperties(RequestLimits.class)
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    private final OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.auth.cookie-secure:true}")
    private boolean secureCookies;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint,
                          OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler,
                          OAuth2LoginFailureHandler oAuth2LoginFailureHandler) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
        this.oAuth2LoginSuccessHandler = oAuth2LoginSuccessHandler;
        this.oAuth2LoginFailureHandler = oAuth2LoginFailureHandler;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, RequestGuard requestGuard, ObjectMapper mapper,
                                           ClientRegistrationRepository clients) throws Exception {
        CookieCsrfTokenRepository csrfTokens = new CookieCsrfTokenRepository();
        csrfTokens.setCookieCustomizer(cookie -> cookie.httpOnly(true).secure(secureCookies)
                .sameSite("Lax").path("/api/auth"));
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens)
                    .requireCsrfProtectionMatcher(request -> CsrfFilter.DEFAULT_CSRF_MATCHER.matches(request)
                            && request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/auth/")))
            .logout(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e -> e.authenticationEntryPoint(jwtAuthenticationEntryPoint)
                    .accessDeniedHandler((request, response, error) -> {
                        response.setStatus(403);
                        response.setCharacterEncoding("UTF-8");
                        response.setContentType("application/json");
                        response.setHeader("Cache-Control", "no-store");
                        response.getWriter().write(error instanceof CsrfException
                                ? "{\"error\":\"CSRF_INVALID\",\"message\":\"요청을 확인하지 못했어요. 다시 시도해주세요.\"}"
                                : "{\"error\":\"FORBIDDEN\",\"message\":\"접근 권한이 없어요.\"}");
                    }))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/posts", "/api/posts/{id}", "/api/posts/{postId}/comments").permitAll()
                .requestMatchers(
                    "/api/auth/csrf", "/api/auth/refresh", "/api/auth/logout",
                    "/oauth2/**",
                    "/login/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth -> oauth
                .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(new SpotifyAuthorizationRequestResolver(clients)))
                .successHandler(oAuth2LoginSuccessHandler)
                .failureHandler(oAuth2LoginFailureHandler))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(new RequestLimitFilter(requestGuard, mapper), JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Retry-After"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
