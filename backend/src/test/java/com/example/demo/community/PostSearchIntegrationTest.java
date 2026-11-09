package com.example.demo.community;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.spotify.SpotifyService.TrackHit;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc @Transactional
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:musicpets-search-test;MODE=MySQL;DB_CLOSE_DELAY=-1")
class PostSearchIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired PostRepository posts;
    @Autowired PostLikeService likes;
    @Autowired JwtTokenProvider tokens;
    @Autowired EntityManager entityManager;
    User owner;
    User other;

    @BeforeEach void setup() {
        owner = users.save(new User(UUID.randomUUID().toString(), "", "작성자"));
        other = users.save(new User(UUID.randomUUID().toString(), "", "다른 작성자"));
        owner.recordAnalysis("mochi");
        other.recordAnalysis("pip");
    }

    Post newPost(User author, String caption, String... tags) {
        Post post = new Post(author);
        post.edit(new TrackHit("spotify:track:5VBjyOQzqlPNgdRPMM6prF", "곡", "가수", ""), caption, List.of(tags));
        return posts.save(post);
    }

    String auth(User user) { return "Bearer " + tokens.createAccessToken(user.getId()); }

    @Test void publicSearchMatchesCaptionOrTagsWithoutDuplicatePosts() throws Exception {
        Long caption = newPost(owner, "Morning 산책 음악").getId();
        Long tags = newPost(other, "잔잔한 노래", "밤산책", "산책음악").getId();
        newPost(other, "작업할 때 듣는 곡", "집중");
        mvc.perform(get("/api/posts").param("q", "산책"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(tags.toString()))
                .andExpect(jsonPath("$.items[1].id").value(caption.toString()));
        mvc.perform(get("/api/posts").param("q", " #산책 "))
                .andExpect(jsonPath("$.items.length()").value(2));
        mvc.perform(get("/api/posts").param("q", "MORNING"))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(caption.toString()));
        Long literal = newPost(owner, "진행률 100%", "guest_name!").getId();
        newPost(owner, "진행률 1000", "guest-name");
        for (String term : List.of("%", "_", "!")) mvc.perform(get("/api/posts").param("q", term))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(literal.toString()));
    }

    @Test void searchFiltersAllRowsBeforePagination() throws Exception {
        for (int i = 0; i < 21; i++) newPost(owner, "오래된 검색 대상 " + i, "밤산책", "산책음악");
        for (int i = 0; i < 21; i++) newPost(other, "새 글 " + i);
        var first = mvc.perform(get("/api/posts").param("q", "산책"))
                .andExpect(jsonPath("$.items.length()").value(20)).andExpect(jsonPath("$.hasMore").value(true)).andReturn();
        var second = mvc.perform(get("/api/posts").param("q", "산책").param("page", "1"))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.hasMore").value(false)).andReturn();
        var ids = new ArrayList<String>();
        for (var response : List.of(first, second)) mapper.readTree(response.getResponse().getContentAsString()).get("items")
                .forEach(row -> ids.add(row.get("id").asText()));
        assertThat(ids).hasSize(21).doesNotHaveDuplicates();
    }

    @Test void searchCombinesWithPopularityPetFiltersAndOwnPosts() throws Exception {
        Long popular = newPost(owner, "산책 인기곡").getId();
        Long latest = newPost(owner, "산책 최신곡").getId();
        Long different = newPost(other, "산책 다른 취향").getId();
        Long unrelated = newPost(other, "검색 대상 밖").getId();
        likes.setLiked(owner.getId(), popular, true);
        likes.setLiked(other.getId(), popular, true);
        likes.setLiked(owner.getId(), different, true);
        likes.setLiked(owner.getId(), unrelated, true);
        likes.setLiked(other.getId(), unrelated, true);
        entityManager.flush();
        entityManager.clear();
        mvc.perform(get("/api/posts").param("q", "산책").param("sort", "popular"))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].id").value(popular.toString()))
                .andExpect(jsonPath("$.items[1].id").value(different.toString()));
        mvc.perform(get("/api/posts").param("q", "산책").param("sort", "popular").param("filter", "same").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items.length()").value(2)).andExpect(jsonPath("$.items[0].id").value(popular.toString()));
        mvc.perform(get("/api/posts").param("q", "산책").param("filter", "other").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(different.toString()));
        mvc.perform(get("/api/posts").param("q", "산책").param("filter", "same").param("pet", "pip").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(different.toString()));
        mvc.perform(get("/api/posts").param("q", "산책").param("view", "mine").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items.length()").value(2)).andExpect(jsonPath("$.items[0].id").value(latest.toString()));
    }

    @Test void blankQueriesShowAllPostsAndOverlongQueriesAreRejected() throws Exception {
        newPost(owner, "음악 이야기");
        for (String term : List.of("", "  ", "##")) mvc.perform(get("/api/posts").param("q", term))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get("/api/posts").param("q", "가".repeat(101))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/posts").param("q", "없는검색어"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
    }
}
