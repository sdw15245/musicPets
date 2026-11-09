package com.example.demo.community;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.spotify.SpotifyService.TrackHit;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:musicpets-likes-test;MODE=MySQL;DB_CLOSE_DELAY=-1")
class PostLikeIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired PostRepository posts;
    @Autowired PostLikeRepository likes;
    @Autowired PostLikeService service;
    @Autowired PostService postService;
    @Autowired JwtTokenProvider tokens;
    User owner;
    User other;
    final List<Long> created = new ArrayList<>();

    @BeforeEach void setup() {
        owner = users.save(new User(UUID.randomUUID().toString(), "", "작성자"));
        other = users.save(new User(UUID.randomUUID().toString(), "", "다른 사용자"));
    }
    @AfterEach void cleanup() {
        for (Long id : created) posts.findById(id).ifPresent(post -> postService.delete(post.getAuthor().getId(), id));
    }
    Post newPost(User author, String caption) {
        Post post = new Post(author);
        post.edit(new TrackHit("spotify:track:5VBjyOQzqlPNgdRPMM6prF", "곡", "가수", ""), caption, List.of());
        post = posts.save(post);
        created.add(post.getId());
        return post;
    }
    String auth(User user) { return "Bearer " + tokens.createAccessToken(user.getId()); }

    @Test void likesAreAuthenticatedIdempotentAndSeparateBetweenAccounts() throws Exception {
        Long id = newPost(owner, "공감할 글").getId();
        String url = "/api/posts/" + id + "/like";
        mvc.perform(put(url)).andExpect(status().isUnauthorized());
        mvc.perform(delete(url)).andExpect(status().isUnauthorized());
        for (int i = 0; i < 2; i++) mvc.perform(put(url).header("Authorization", auth(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.likes").value(1)).andExpect(jsonPath("$.liked").value(true));
        mvc.perform(put(url).header("Authorization", auth(other))).andExpect(jsonPath("$.likes").value(2));
        mvc.perform(get("/api/posts/" + id)).andExpect(jsonPath("$.likes").value(2)).andExpect(jsonPath("$.liked").value(false));
        mvc.perform(get("/api/posts/" + id).header("Authorization", auth(owner))).andExpect(jsonPath("$.liked").value(true));
        for (int i = 0; i < 2; i++) mvc.perform(delete(url).header("Authorization", auth(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.likes").value(1)).andExpect(jsonPath("$.liked").value(false));
        mvc.perform(get("/api/posts/" + id).header("Authorization", auth(other))).andExpect(jsonPath("$.liked").value(true));
        mvc.perform(get("/api/posts").header("Authorization", auth(other)))
                .andExpect(jsonPath("$.items[0].liked").value(true)).andExpect(jsonPath("$.items[0].likes").value(1));
    }

    @Test void popularitySortsAllRowsBeforePaginationAndKeepsLatestFirstForTies() throws Exception {
        owner.recordAnalysis("mochi"); users.save(owner);
        other.recordAnalysis("pip"); users.save(other);
        Long oldest = newPost(owner, "가장 오래된 인기글").getId();
        for (int i = 0; i < 22; i++) newPost(owner, "새 글 " + i);
        Long newest = newPost(other, "다른 펫 인기글").getId();
        service.setLiked(owner.getId(), oldest, true);
        service.setLiked(other.getId(), oldest, true);
        service.setLiked(owner.getId(), newest, true);
        var first = mvc.perform(get("/api/posts").param("sort", "popular"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(oldest.toString()))
                .andExpect(jsonPath("$.items[1].id").value(newest.toString()))
                .andExpect(jsonPath("$.items[2].id").value(created.get(22).toString()))
                .andExpect(jsonPath("$.items.length()").value(20)).andExpect(jsonPath("$.hasMore").value(true)).andReturn();
        var second = mvc.perform(get("/api/posts").param("sort", "popular").param("page", "1"))
                .andExpect(jsonPath("$.items.length()").value(4)).andExpect(jsonPath("$.hasMore").value(false)).andReturn();
        var ids = new ArrayList<String>();
        for (var response : List.of(first, second)) mapper.readTree(response.getResponse().getContentAsString()).get("items").forEach(row -> ids.add(row.get("id").asText()));
        assertThat(ids).doesNotHaveDuplicates().hasSize(24);
        mvc.perform(get("/api/posts").param("sort", "latest")).andExpect(jsonPath("$.items[0].id").value(newest.toString()));
        mvc.perform(get("/api/posts").param("sort", "popular").param("filter", "same").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items[0].id").value(oldest.toString()));
        mvc.perform(get("/api/posts").param("sort", "popular").param("filter", "other").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(newest.toString()));
        mvc.perform(get("/api/posts").param("sort", "popular").param("view", "mine").header("Authorization", auth(other)))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(newest.toString()));
        mvc.perform(get("/api/posts").param("sort", "invalid")).andExpect(status().isBadRequest());
    }

    @Test void concurrentRequestsDoNotDuplicateLikesOrLoseOtherAccountsLikes() throws Exception {
        Long id = newPost(owner, "동시 요청").getId();
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(8)) {
            var futures = new ArrayList<java.util.concurrent.Future<?>>();
            for (int i = 0; i < 8; i++) {
                Long userId = i % 2 == 0 ? owner.getId() : other.getId();
                futures.add(executor.submit(() -> { start.await(); service.setLiked(userId, id, true); return null; }));
            }
            start.countDown();
            for (var future : futures) future.get(15, TimeUnit.SECONDS);
        }
        assertThat(likes.countByPostId(id)).isEqualTo(2);
        assertThat(service.setLiked(owner.getId(), id, false).likes()).isEqualTo(1);
    }

    @Test void deletingPostRemovesLikesAndMissingPostsRejectLikeChanges() throws Exception {
        Long id = newPost(owner, "삭제할 글").getId();
        service.setLiked(other.getId(), id, true);
        mvc.perform(delete("/api/posts/" + id).header("Authorization", auth(owner))).andExpect(status().isNoContent());
        assertThat(likes.countByPostId(id)).isZero();
        mvc.perform(put("/api/posts/" + id + "/like").header("Authorization", auth(other))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/" + id + "/like").header("Authorization", auth(other))).andExpect(status().isNotFound());
    }
}
