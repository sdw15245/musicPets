package com.example.demo.config;

import com.example.demo.auth.AuthCookies;
import com.example.demo.auth.OAuth2LoginSuccessHandler;
import com.example.demo.auth.OAuth2LoginFailureHandler;
import com.example.demo.auth.SpotifyAuthorizationRequestResolver;
import com.example.demo.error.ErrorCode;
import com.example.demo.error.ErrorResponseWriter;
import com.example.demo.jwt.JwtAuthenticationEntryPoint;
import com.example.demo.jwt.JwtAuthenticationFilter;
import com.example.demo.jwt.JwtTokenProvider;
import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
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

/**
 * 인증·인가 규칙. 공개 경로는 여기서만 정한다.
 * 요청 예산은 컨트롤러 메서드의 @RateLimited로 정한다(ratelimit 패키지).
 */
@Configuration
public class SecurityConfig {

    private final JwtTokenProvider tokens;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    private final OAuth2LoginFailureHandler oAuth2LoginFailureHandler;
    private final AuthCookies cookies;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    public SecurityConfig(JwtTokenProvider tokens,
                          JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint,
                          OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler,
                          OAuth2LoginFailureHandler oAuth2LoginFailureHandler,
                          AuthCookies cookies) {
        this.tokens = tokens;
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
        this.oAuth2LoginSuccessHandler = oAuth2LoginSuccessHandler;
        this.oAuth2LoginFailureHandler = oAuth2LoginFailureHandler;
        this.cookies = cookies;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ErrorResponseWriter errors,
                                           ClientRegistrationRepository clients) throws Exception {
        CookieCsrfTokenRepository csrfTokens = new CookieCsrfTokenRepository();
        csrfTokens.setCookieCustomizer(cookies::configure);
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens)
                    .requireCsrfProtectionMatcher(request -> CsrfFilter.DEFAULT_CSRF_MATCHER.matches(request)
                            && request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/auth/")))
            .logout(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e -> e.authenticationEntryPoint(jwtAuthenticationEntryPoint)
                    .accessDeniedHandler((request, response, error) -> errors.write(response,
                            error instanceof CsrfException ? ErrorCode.CSRF_INVALID : ErrorCode.FORBIDDEN)))
            .authorizeHttpRequests(auth -> auth
                // 컨테이너 오류 페이지 재전달에는 JWT 인증이 없어, 막으면 원래 상태 코드가 401로 바뀐다.
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/posts", "/api/posts/{id}", "/api/posts/{postId}/comments").permitAll()
                .requestMatchers(
                    "/api/auth/csrf", "/api/auth/refresh", "/api/auth/logout",
                    "/actuator/health/readiness",
                    "/oauth2/**",
                    "/login/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth -> oauth
                .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(new SpotifyAuthorizationRequestResolver(clients)))
                .successHandler(oAuth2LoginSuccessHandler)
                .failureHandler(oAuth2LoginFailureHandler))
            // 빈으로 등록하지 않는다. 빈이면 Spring Boot가 서블릿 필터로도 한 번 더 등록한다.
            .addFilterBefore(new JwtAuthenticationFilter(tokens), UsernamePasswordAuthenticationFilter.class);

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
