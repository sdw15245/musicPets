package com.example.demo.community;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import com.example.demo.user.ProfileService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc
class PostIntegrationTest {
    static final String TRACK = "5VBjyOQzqlPNgdRPMM6prF";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired PostRepository posts;
    @Autowired PostService service;
    @Autowired ProfileService profiles;
    @Autowired JwtTokenProvider tokens;
    @Autowired PlatformTransactionManager transactions;
    @MockitoBean SpotifyService spotify;
    User owner;
    User other;

    @BeforeEach void setup() {
        posts.deleteAll();
        owner = users.save(new User(UUID.randomUUID().toString(), "secret@example.com", "작성자"));
        other = users.save(new User(UUID.randomUUID().toString(), "", "다른 사람"));
        when(spotify.getTrack(anyLong(), eq(TRACK))).thenReturn(new SpotifyService.TrackHit("spotify:track:" + TRACK, "공식 곡명", "공식 가수", ""));
    }
    String auth(User user) { return "Bearer " + tokens.createAccessToken(user.getId()); }
    void analyze(User user, String pet) {
        new TransactionTemplate(transactions).executeWithoutResult(status ->
                users.findById(user.getId()).orElseThrow().recordAnalysis(pet));
    }
    String body(String caption) throws Exception {
        return mapper.writeValueAsString(Map.of("trackUri", "spotify:track:" + TRACK, "caption", caption, "tags", List.of("산책"), "authorId", other.getId(), "author", "위조 이름"));
    }
    String createPost() throws Exception {
        var result = mvc.perform(post("/api/posts").header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content(body("나의 이야기")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.author").value("작성자"))
                .andExpect(jsonPath("$.track.name").value("공식 곡명")).andExpect(jsonPath("$.own").value(true)).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }

    @Test void publicReadAndOwnerOnlyCrudUseServerIdentity() throws Exception {
        mvc.perform(get("/api/posts")).andExpect(status().isOk());
        mvc.perform(get("/api/posts").param("view", "mine")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/posts").contentType(MediaType.APPLICATION_JSON).content(body("게스트"))).andExpect(status().isUnauthorized());
        String id = createPost();
        mvc.perform(get("/api/posts/" + id)).andExpect(status().isOk()).andExpect(jsonPath("$.own").value(false))
                .andExpect(jsonPath("$.email").doesNotExist()).andExpect(jsonPath("$.spotifyId").doesNotExist())
                .andExpect(jsonPath("$.avatarSlug").isEmpty());
        mvc.perform(put("/api/posts/" + id).header("Authorization", auth(other)).contentType(MediaType.APPLICATION_JSON).content(body("공격")))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/posts/" + id).header("Authorization", auth(other))).andExpect(status().isForbidden());
        mvc.perform(put("/api/posts/" + id).header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content(body("수정 내용")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.caption").value("수정 내용"));
        verify(spotify, times(1)).getTrack(owner.getId(), TRACK);
        mvc.perform(get("/api/posts").header("Authorization", auth(other)).param("view", "mine"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
        profiles.edit(owner.getId(), new ProfileService.EditProfile("새 닉네임"));
        analyze(owner, "pip");
        mvc.perform(get("/api/posts/" + id)).andExpect(jsonPath("$.author").value("새 닉네임"))
                .andExpect(jsonPath("$.avatarSlug").value("pip"));
        analyze(owner, "mochi");
        mvc.perform(get("/api/posts/" + id)).andExpect(jsonPath("$.avatarSlug").value("mochi"));
        mvc.perform(delete("/api/posts/" + id).header("Authorization", auth(owner))).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/" + id)).andExpect(status().isNotFound());
        assertThat(posts.count()).isZero();
    }

    @Test void paginationAndPetFiltersWorkAcrossDatabaseRows() throws Exception {
        owner.recordAnalysis("mochi"); users.save(owner);
        other.recordAnalysis("pip"); users.save(other);
        for (int i = 0; i < 21; i++) service.create(owner.getId(), new PostService.EditPost("spotify:track:" + TRACK, "글 " + i, List.of()));
        service.create(other.getId(), new PostService.EditPost("spotify:track:" + TRACK, "다른 펫", List.of()));
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.items.length()").value(20)).andExpect(jsonPath("$.hasMore").value(true));
        mvc.perform(get("/api/posts").param("page", "1")).andExpect(jsonPath("$.items.length()").value(2)).andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(get("/api/posts").param("filter", "same")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/posts").param("filter", "other").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].caption").value("다른 펫"));
        mvc.perform(get("/api/posts").param("page", "-1")).andExpect(status().isBadRequest());
    }

    @Test void validationAndSpotifyFailureDoNotCreatePartialPosts() throws Exception {
        mvc.perform(post("/api/posts").header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content(body(" ")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/posts").header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackUri\":\"javascript:bad\",\"caption\":\"글\",\"tags\":[]}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(spotify);
        when(spotify.getTrack(anyLong(), eq(TRACK))).thenThrow(new org.springframework.web.client.RestClientException("secret"));
        mvc.perform(post("/api/posts").header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content(body("정상 글")))
                .andExpect(status().isBadGateway()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret"))));
        assertThat(posts.count()).isZero();
    }

    @Test void searchIsAuthenticatedAndPreservesSpotifyFailureContracts() throws Exception {
        mvc.perform(get("/api/tracks/search").param("q", "곡")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/tracks/search").param("q", " ").header("Authorization", auth(owner))).andExpect(status().isBadRequest());
        when(spotify.searchTracks(owner.getId(), "곡", 10)).thenReturn(List.of());
        mvc.perform(get("/api/tracks/search").param("q", "곡").header("Authorization", auth(owner)))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        when(spotify.searchTracks(owner.getId(), "곡", 10)).thenThrow(new com.example.demo.spotify.SpotifyReauthorizationRequiredException());
        mvc.perform(get("/api/tracks/search").param("q", "곡").header("Authorization", auth(owner)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("SPOTIFY_REAUTH_REQUIRED"));
    }
}
