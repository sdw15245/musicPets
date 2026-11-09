package com.example.demo.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "SPOTIFY_REDIRECT_URI=https://musicpets.example.com/login/oauth2/code/spotify",
        "management.endpoint.health.probes.enabled=true",
        "management.endpoint.health.group.readiness.include=readinessState,db"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class DeploymentConfigurationTest {
    @Autowired MockMvc mvc;

    @Test void oauthUsesConfiguredPublicCallback() throws Exception {
        mvc.perform(get("/oauth2/authorization/spotify"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", containsString(
                        "redirect_uri=https://musicpets.example.com/login/oauth2/code/spotify")));
    }

    @Test void readinessIsAvailableWithoutCredentialsAndHidesDetails() throws Exception {
        mvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist());
    }

    @Test void readinessDoesNotMakeOtherEndpointsPublic() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }
}
