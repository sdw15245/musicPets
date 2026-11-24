package com.example.demo.auth;

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

import java.io.IOException;

/**
 * Spotify 로그인 성공 후: OAuth 결과를 AuthService에 넘기고, 받은 refresh 토큰을 쿠키로만 전달해 프론트로 redirect.
 * 주소에는 토큰을 싣지 않는다.
 */
@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService auth;
    private final OAuth2AuthorizedClientService authorizedClientService;
    private final AuthCookies cookies;
    private final String successRedirectUri;

    public OAuth2LoginSuccessHandler(AuthService auth,
                                     OAuth2AuthorizedClientService authorizedClientService,
                                     AuthCookies cookies,
                                     @Value("${app.oauth2.success-redirect}") String successRedirectUri) {
        this.auth = auth;
        this.authorizedClientService = authorizedClientService;
        this.cookies = cookies;
        this.successRedirectUri = successRedirectUri;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User oauthUser = oauthToken.getPrincipal();
        OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                oauthToken.getAuthorizedClientRegistrationId(), oauthToken.getName());

        String refreshToken = auth.login(new AuthService.SpotifyLogin(oauthUser.getName(),
                oauthUser.getAttribute("email"), oauthUser.getAttribute("display_name"), spotifyTokens(client)));

        cookies.set(response, refreshToken);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        getRedirectStrategy().sendRedirect(request, response, successRedirectUri);
    }

    private static AuthService.SpotifyTokens spotifyTokens(OAuth2AuthorizedClient client) {
        if (client == null) return null;
        return new AuthService.SpotifyTokens(client.getAccessToken().getTokenValue(),
                client.getRefreshToken() == null ? null : client.getRefreshToken().getTokenValue(),
                client.getAccessToken().getExpiresAt());
    }
}
