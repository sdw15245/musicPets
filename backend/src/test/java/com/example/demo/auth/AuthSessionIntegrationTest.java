package com.example.demo.auth;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc @Transactional
class AuthSessionIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired JwtTokenProvider tokens;
    @Autowired OAuth2LoginSuccessHandler login;
    @MockitoBean SpotifyService spotify;
    @MockitoBean OAuth2AuthorizedClientService authorizedClients;

    record Csrf(Cookie cookie, String header, String value) {
        MockHttpServletRequestBuilder apply(MockHttpServletRequestBuilder request) {
            return request.cookie(cookie).header(header, value);
        }
    }

    Csrf csrf() throws Exception {
        var response = mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse();
        var body = mapper.readTree(response.getContentAsString());
        return new Csrf(response.getCookie("XSRF-TOKEN"), body.get("headerName").asText(), body.get("token").asText());
    }

    User user() { return users.save(new User("auth-" + UUID.randomUUID(), "", "Session test")); }
    String refresh(User user, Instant expiry) {
        String token = tokens.createRefreshToken(user.getId());
        refreshTokens.save(new RefreshToken(token, user.getId(), expiry));
        return token;
    }
    String refresh() { return refresh(user(), Instant.now().plusSeconds(3600)); }
    Cookie credential(String token) { return new Cookie(AuthCookies.REFRESH, token); }

    @Test void csrfEndpointUsesHttpOnlyHostCookieAndMaskedHeaderWithoutServerSession() throws Exception {
        var result = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSecure()).isFalse(); // Local test profile only.
        assertThat(cookie.getDomain()).isNull();
        assertThat(cookie.getPath()).isEqualTo("/api/auth");
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
        assertThat(mapper.readTree(result.getResponse().getContentAsString()).get("token").asText())
                .isNotBlank().isNotEqualTo(cookie.getValue());
        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test void refreshRequiresCookieAndCsrfAndReturnsOnlyUncachedAccess() throws Exception {
        String refresh = refresh();
        var response = mvc.perform(csrf().apply(post("/api/auth/refresh")).cookie(credential(refresh)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.refresh").doesNotExist()).andReturn().getResponse();
        String access = mapper.readTree(response.getContentAsString()).get("access").asText();
        assertThat(tokens.isAccessToken(access)).isTrue();
        assertThat(tokens.getUserId(access)).isEqualTo(tokens.getUserId(refresh));
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + access)).andExpect(status().isOk());
        mvc.perform(get("/api/me").cookie(credential(refresh))).andExpect(status().isUnauthorized());
    }

    @Test void cookieAloneCannotRefreshOrLogOutEvenWithAllowedOrigin() throws Exception {
        String refresh = refresh();
        for (String path : List.of("refresh", "logout")) {
            mvc.perform(post("/api/auth/" + path).cookie(credential(refresh)).header("Origin", "http://127.0.0.1:5173"))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_INVALID"));
        }
        assertThat(refreshTokens.findByToken(refresh)).isPresent();
    }

    @Test void wrongCsrfAndForeignOriginCannotChangeSession() throws Exception {
        String refresh = refresh();
        Csrf csrf = csrf();
        mvc.perform(post("/api/auth/logout").cookie(csrf.cookie(), credential(refresh)).header(csrf.header(), "wrong"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_INVALID"));
        mvc.perform(csrf.apply(post("/api/auth/logout")).cookie(credential(refresh)).header("Origin", "https://foreign.invalid"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        assertThat(refreshTokens.findByToken(refresh)).isPresent();
    }

    @Test void bodyRefreshTokenCannotAuthenticate() throws Exception {
        mvc.perform(csrf().apply(post("/api/auth/refresh")).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("refresh", refresh()))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("SESSION_EXPIRED"));
    }

    @Test void invalidRevokedAccessAndExpiredRefreshTokensClearCookieWithoutLeakingDetails() throws Exception {
        List<String> invalid = List.of("malformed", tokens.createAccessToken(user().getId()),
                tokens.createRefreshToken(user().getId()), refresh(user(), Instant.now().minusSeconds(1)));
        for (String token : invalid) {
            var response = mvc.perform(csrf().apply(post("/api/auth/refresh")).cookie(credential(token)))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("SESSION_EXPIRED"))
                    .andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse();
            assertThat(response.getCookie(AuthCookies.REFRESH).getMaxAge()).isZero();
            assertThat(response.getContentAsString()).doesNotContain(token);
        }
    }

    @Test void logoutRevokesRefreshAndClearsCookieWithoutAnAccessToken() throws Exception {
        String refresh = refresh();
        var response = mvc.perform(csrf().apply(post("/api/auth/logout")).cookie(credential(refresh)))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse();
        assertThat(refreshTokens.findByToken(refresh)).isEmpty();
        Cookie cleared = response.getCookie(AuthCookies.REFRESH);
        assertThat(cleared.getMaxAge()).isZero();
        assertThat(cleared.isHttpOnly()).isTrue();
        assertThat(cleared.getPath()).isEqualTo("/api/auth");
        mvc.perform(csrf().apply(post("/api/auth/refresh")).cookie(credential(refresh))).andExpect(status().isUnauthorized());
        mvc.perform(csrf().apply(post("/api/auth/logout"))).andExpect(status().isNoContent());
    }

    @Test void successfulOAuthRedirectContainsNoTokensAndSetsOnlyRefreshCookie() throws Exception {
        String spotifyId = "oauth-" + UUID.randomUUID();
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        var principal = new DefaultOAuth2User(authorities, Map.of("id", spotifyId, "display_name", "Test", "email", ""), "id");
        var authentication = new OAuth2AuthenticationToken(principal, authorities, "spotify");
        var response = new MockHttpServletResponse();
        login.onAuthenticationSuccess(new MockHttpServletRequest(), response, authentication);
        assertThat(response.getRedirectedUrl()).isEqualTo("http://127.0.0.1:5173/oauth/callback");
        assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(response.getHeader("Referrer-Policy")).isEqualTo("no-referrer");
        Cookie cookie = response.getCookie(AuthCookies.REFRESH);
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/api/auth");
        assertThat(cookie.getDomain()).isNull();
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
        assertThat(cookie.getMaxAge()).isEqualTo(tokens.getRefreshExpirationMs() / 1000);
        assertThat(tokens.isRefreshToken(cookie.getValue())).isTrue();
        assertThat(refreshTokens.findByToken(cookie.getValue())).isPresent();
        assertThat(response.getContentAsString()).isEmpty();
    }

    @Test void productionCredentialAndDeletionBothUseSecureCookie() {
        AuthCookies cookies = new AuthCookies(true, tokens);
        var set = new MockHttpServletResponse();
        cookies.set(set, "test-credential");
        assertThat(set.getCookie(AuthCookies.REFRESH).getSecure()).isTrue();
        var clear = new MockHttpServletResponse();
        cookies.clear(clear);
        assertThat(clear.getCookie(AuthCookies.REFRESH).getSecure()).isTrue();
        assertThat(clear.getCookie(AuthCookies.REFRESH).getMaxAge()).isZero();
    }

    @Test void infrastructureFailuresReturnRetryableErrorAndDoNotClearCredentials() throws Exception {
        AuthService service = mock(AuthService.class);
        when(service.refresh("test-credential")).thenThrow(new IllegalStateException("private-database-detail"));
        doThrow(new IllegalStateException("private-database-detail")).when(service).logout("test-credential");
        var isolated = standaloneSetup(new AuthController(service, new AuthCookies(false, tokens)))
                .setControllerAdvice(new AuthExceptionHandler()).build();
        for (String path : List.of("refresh", "logout")) {
            isolated.perform(post("/api/auth/" + path).cookie(credential("test-credential")))
                    .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error").value("AUTH_UNAVAILABLE"))
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(header().doesNotExist("Set-Cookie"))
                    .andExpect(content().string(not(containsString("private-database-detail"))));
        }
    }
}
