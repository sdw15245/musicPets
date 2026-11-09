package com.example.demo.auth;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.spotify.SpotifyToken;
import com.example.demo.spotify.SpotifyTokenRepository;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Instant;

/**
 * Spotify 로그인 성공 후 처리: User upsert + Spotify 토큰 저장 + 우리 JWT 발급 + 프론트로 redirect.
 */
@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SpotifyTokenRepository spotifyTokenRepository;
    private final OAuth2AuthorizedClientService authorizedClientService;
    private final JwtTokenProvider tokenProvider;
    private final String successRedirectUri;
    private final AuthCookies cookies;

    public OAuth2LoginSuccessHandler(UserRepository userRepository,
                                     RefreshTokenRepository refreshTokenRepository,
                                     SpotifyTokenRepository spotifyTokenRepository,
                                     OAuth2AuthorizedClientService authorizedClientService,
                                     JwtTokenProvider tokenProvider,
                                     AuthCookies cookies,
                                     @Value("${app.oauth2.success-redirect}") String successRedirectUri) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.spotifyTokenRepository = spotifyTokenRepository;
        this.authorizedClientService = authorizedClientService;
        this.tokenProvider = tokenProvider;
        this.successRedirectUri = successRedirectUri;
        this.cookies = cookies;
    }

    @Override
    @Transactional
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User oauthUser = oauthToken.getPrincipal();

        String spotifyId = oauthUser.getName();
        String email = oauthUser.getAttribute("email");
        String displayName = oauthUser.getAttribute("display_name");

        // 1) User upsert
        User user = userRepository.findBySpotifyId(spotifyId)
                .map(existing -> {
                    existing.updateProfile(email, displayName);
                    return existing;
                })
                .orElseGet(() -> userRepository.save(new User(spotifyId, email, displayName)));

        // 2) Spotify access/refresh 토큰 저장
        OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                oauthToken.getAuthorizedClientRegistrationId(), oauthToken.getName());
        if (client != null) {
            String spotifyAccess = client.getAccessToken().getTokenValue();
            Instant spotifyExpiresAt = client.getAccessToken().getExpiresAt();
            String spotifyRefresh = client.getRefreshToken() != null
                    ? client.getRefreshToken().getTokenValue() : null;

            spotifyTokenRepository.findById(user.getId())
                    .ifPresentOrElse(
                            existing -> existing.update(spotifyAccess, spotifyRefresh, spotifyExpiresAt),
                            () -> spotifyTokenRepository.save(
                                    new SpotifyToken(user.getId(), spotifyAccess, spotifyRefresh, spotifyExpiresAt))
                    );
        }

        // 3) 장기 토큰은 HttpOnly 쿠키로만 전달한다.
        String refreshToken = tokenProvider.createRefreshToken(user.getId());

        refreshTokenRepository.deleteByUserId(user.getId());
        refreshTokenRepository.save(new RefreshToken(
                refreshToken,
                user.getId(),
                Instant.now().plusMillis(tokenProvider.getRefreshExpirationMs())
        ));

        cookies.set(response, refreshToken);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        getRedirectStrategy().sendRedirect(request, response, successRedirectUri);
    }
}
