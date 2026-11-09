package com.example.demo.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.assertThat;

class OAuth2LoginFailureHandlerTest {
    @Test
    void redirectsToFrontendWithoutExposingProviderError() throws Exception {
        var handler = new OAuth2LoginFailureHandler("http://localhost:5173/login?oauthError=spotify");
        var response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(new MockHttpServletRequest(), response,
                new BadCredentialsException("provider detail must stay private"));

        assertThat(response.getStatus()).isEqualTo(302);
        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:5173/login?oauthError=spotify");
        assertThat(response.getContentAsString()).doesNotContain("provider detail");
    }
}
