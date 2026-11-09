package com.example.demo.community;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.UUID;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc
class RetiredLibraryApiTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider tokens;
    @MockitoBean SpotifyService spotify;

    @Test void retiredLibraryCannotReadOrWriteThroughOldApiLinks() throws Exception {
        var user = users.save(new User(UUID.randomUUID().toString(), "", "종료된 보관함"));
        String auth = "Bearer " + tokens.createAccessToken(user.getId());
        String trackPath = "/api/library/5VBjyOQzqlPNgdRPMM6prF";
        mvc.perform(get("/api/library").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(get("/api/library/ids").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(put(trackPath).header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(delete(trackPath).header("Authorization", auth)).andExpect(status().isNotFound());
        verifyNoInteractions(spotify);
    }
}
