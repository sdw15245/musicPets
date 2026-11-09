package com.example.demo.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;

import static org.assertj.core.api.Assertions.assertThat;

class SpotifyAuthorizationRequestResolverTest {
    private final InMemoryClientRegistrationRepository clients = new InMemoryClientRegistrationRepository(
            ClientRegistration.withRegistrationId("spotify").clientId("test-client").clientSecret("test-secret")
                    .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                    .redirectUri("http://localhost/login/oauth2/code/spotify")
                    .authorizationUri("https://accounts.spotify.com/authorize")
                    .tokenUri("https://accounts.spotify.com/api/token").scope("user-top-read").build());

    @Test
    void ordinaryLoginKeepsAutomaticApproval() {
        var resolver = new SpotifyAuthorizationRequestResolver(clients);
        var request = resolver.resolve(request(false));
        assertThat(request.getAdditionalParameters()).doesNotContainKey("show_dialog");
        assertThat(request.getState()).isNotBlank();
    }

    @Test
    void accountSwitchRequiresApprovalAndPreservesStateScopeAndCallback() {
        var resolver = new SpotifyAuthorizationRequestResolver(clients);
        var request = resolver.resolve(request(true));
        assertThat(request.getAdditionalParameters()).containsEntry("show_dialog", "true");
        assertThat(request.getAuthorizationRequestUri()).contains("show_dialog=true");
        assertThat(request.getState()).isNotBlank();
        assertThat(request.getScopes()).containsExactly("user-top-read");
        assertThat(request.getRedirectUri()).isEqualTo("http://localhost/login/oauth2/code/spotify");
    }

    private MockHttpServletRequest request(boolean switching) {
        var request = new MockHttpServletRequest("GET", "/oauth2/authorization/spotify");
        request.setServletPath("/oauth2/authorization/spotify");
        if (switching) request.addParameter("switch_account", "true");
        return request;
    }
}
