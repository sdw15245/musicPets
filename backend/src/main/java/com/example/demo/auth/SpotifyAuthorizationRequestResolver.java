package com.example.demo.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/** Reconfirm consent only for an explicit account switch; this does not sign Spotify out. */
public final class SpotifyAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {
    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public SpotifyAuthorizationRequestResolver(ClientRegistrationRepository clients) {
        delegate = new DefaultOAuth2AuthorizationRequestResolver(clients, "/oauth2/authorization");
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return customize(request, delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String registrationId) {
        return customize(request, delegate.resolve(request, registrationId));
    }

    private OAuth2AuthorizationRequest customize(HttpServletRequest request, OAuth2AuthorizationRequest authorization) {
        if (authorization == null || !"spotify".equals(authorization.getAttribute("registration_id"))
                || !"true".equals(request.getParameter("switch_account"))) return authorization;
        return OAuth2AuthorizationRequest.from(authorization)
                .additionalParameters(parameters -> parameters.put("show_dialog", "true"))
                .build();
    }
}
