package com.example.demo.community;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc @Transactional
class CommentIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired PostRepository posts;
    @Autowired CommentRepository comments;
    @Autowired CommentService service;
    @Autowired JwtTokenProvider tokens;
    @Autowired EntityManager entityManager;
    User owner;
    User other;
    Long postId;

    @BeforeEach void setup() {
        owner = users.save(new User(UUID.randomUUID().toString(), "private@example.com", "댓글 작성자"));
        other = users.save(new User(UUID.randomUUID().toString(), "", "다른 사람"));
        postId = newPost().getId();
    }
    Post newPost() {
        Post post = new Post(owner);
        post.edit(new SpotifyService.TrackHit("spotify:track:5VBjyOQzqlPNgdRPMM6prF", "곡", "가수", ""), "이야기", List.of());
        return posts.save(post);
    }
    String url() { return "/api/posts/" + postId + "/comments"; }
    String auth(User user) { return "Bearer " + tokens.createAccessToken(user.getId()); }
    String body(String text) throws Exception { return mapper.writeValueAsString(Map.of("body", text, "authorId", other.getId(), "author", "위조")); }

    @Test void notificationFocusFindsTheReplyThreadBeyondFirstPageAndRejectsMissingTargets() throws Exception {
        var root = service.create(owner.getId(), postId, new CommentService.CreateComment("오래된 대화", null));
        for (int i = 0; i < 21; i++) service.create(owner.getId(), postId, new CommentService.CreateComment("새 대화 " + i, null));
        var reply = service.create(other.getId(), postId, new CommentService.CreateComment("알림에서 찾을 답글", Long.valueOf(root.id())));
        service.delete(owner.getId(), postId, Long.valueOf(root.id()));
        mvc.perform(get(url()).param("focus", reply.id()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.items[?(@.id == '" + reply.id() + "')].body").value(org.hamcrest.Matchers.hasItem("알림에서 찾을 답글")));
        mvc.perform(get(url()).param("focus", root.id())).andExpect(status().isNotFound());
        mvc.perform(get("/api/posts/" + newPost().getId() + "/comments").param("focus", reply.id())).andExpect(status().isNotFound());
    }
    String create(User user, String text, String parentId) throws Exception {
        var request = parentId == null ? body(text) : mapper.writeValueAsString(Map.of("body", text, "parentId", parentId));
        var result = mvc.perform(post(url()).header("Authorization", auth(user)).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.own").value(true)).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }

    @Test void serverIdentityAndOwnershipAreEnforcedAndPublicReadUsesCurrentProfile() throws Exception {
        mvc.perform(get(url())).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(post(url()).contentType(MediaType.APPLICATION_JSON).content(body("게스트"))).andExpect(status().isUnauthorized());
        String id = create(owner, "  공개 댓글  ", null);
        mvc.perform(get(url())).andExpect(jsonPath("$.items[0].body").value("공개 댓글"))
                .andExpect(jsonPath("$.items[0].author").value("댓글 작성자"))
                .andExpect(jsonPath("$.items[0].avatarSlug").isEmpty())
                .andExpect(jsonPath("$.items[0].own").value(false))
                .andExpect(jsonPath("$.items[0].email").doesNotExist())
                .andExpect(jsonPath("$.items[0].authorId").doesNotExist());
        mvc.perform(put(url() + "/" + id).contentType(MediaType.APPLICATION_JSON).content(body("게스트 수정"))).andExpect(status().isUnauthorized());
        mvc.perform(delete(url() + "/" + id)).andExpect(status().isUnauthorized());
        mvc.perform(put(url() + "/" + id).header("Authorization", auth(other)).contentType(MediaType.APPLICATION_JSON).content(body("남의 댓글 수정")))
                .andExpect(status().isForbidden());
        mvc.perform(delete(url() + "/" + id).header("Authorization", auth(other))).andExpect(status().isForbidden());
        mvc.perform(put(url() + "/" + id).header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content(body("수정 완료")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.body").value("수정 완료"));
        owner.editProfile("새 이름");
        owner.recordAnalysis("pip");
        entityManager.flush(); entityManager.clear();
        mvc.perform(get(url())).andExpect(jsonPath("$.items[0].author").value("새 이름"))
                .andExpect(jsonPath("$.items[0].avatarSlug").value("pip"))
                .andExpect(jsonPath("$.items[0].body").value("수정 완료"));
    }

    @Test void parentDeletionErasesContentButPreservesReplyAndPostDeletionRemovesBoth() throws Exception {
        String root = create(owner, "삭제할 원문", null);
        String reply = create(other, "남길 답글", root);
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.commentCount").value(2));
        mvc.perform(delete(url() + "/" + root).header("Authorization", auth(owner))).andExpect(status().isNoContent());
        entityManager.flush(); entityManager.clear();
        mvc.perform(get(url())).andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].deleted").value(true)).andExpect(jsonPath("$.items[0].body").value(""))
                .andExpect(jsonPath("$.items[0].author").value(""))
                .andExpect(jsonPath("$.items[1].body").value("남길 답글"));
        mvc.perform(put(url() + "/" + root).header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content(body("복구 시도")))
                .andExpect(status().isNotFound());
        mvc.perform(put(url() + "/" + reply).header("Authorization", auth(other)).contentType(MediaType.APPLICATION_JSON).content(body("답글 수정")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.commentCount").value(1));
        mvc.perform(delete("/api/posts/" + postId).header("Authorization", auth(other))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/posts/" + postId).header("Authorization", auth(owner))).andExpect(status().isNoContent());
        entityManager.flush(); entityManager.clear();
        assertThat(comments.findById(Long.valueOf(root))).isEmpty();
        assertThat(comments.findById(Long.valueOf(reply))).isEmpty();
        mvc.perform(get(url())).andExpect(status().isNotFound());
        mvc.perform(post(url()).header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content(body("삭제된 글")))
                .andExpect(status().isNotFound());
    }

    @Test void invalidBodiesCrossPostParentsAndNestedRepliesAreRejected() throws Exception {
        for (String text : List.of("  \n ", "a".repeat(501))) {
            mvc.perform(post(url()).header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content(body(text)))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post(url()).header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        String root = create(owner, "원댓글", null);
        String reply = create(other, "답글", root);
        mvc.perform(post(url()).header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("body", "2단계 답글", "parentId", reply))))
                .andExpect(status().isBadRequest());
        Long anotherPost = newPost().getId();
        mvc.perform(post("/api/posts/" + anotherPost + "/comments").header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("body", "잘못된 연결", "parentId", root))))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/" + anotherPost + "/comments/" + root).header("Authorization", auth(owner)))
                .andExpect(status().isNotFound());
        mvc.perform(delete(url() + "/" + root).header("Authorization", auth(owner))).andExpect(status().isNoContent());
        mvc.perform(post(url()).header("Authorization", auth(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("body", "삭제 후 답글", "parentId", root))))
                .andExpect(status().isBadRequest());
    }

    @Test void paginationKeepsRepliesWithTheirParent() throws Exception {
        var oldest = service.create(owner.getId(), postId, new CommentService.CreateComment("오래된 원댓글", null));
        for (int i = 0; i < 20; i++) service.create(owner.getId(), postId, new CommentService.CreateComment("원댓글 " + i, null));
        service.create(other.getId(), postId, new CommentService.CreateComment("늦게 달린 답글", Long.valueOf(oldest.id())));
        mvc.perform(get(url())).andExpect(jsonPath("$.items.length()").value(20)).andExpect(jsonPath("$.hasMore").value(true));
        mvc.perform(get(url()).param("page", "1")).andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(oldest.id())).andExpect(jsonPath("$.items[1].body").value("늦게 달린 답글"))
                .andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(get(url()).param("page", "-1")).andExpect(status().isBadRequest());
    }

    @Test void feedCountsAllLiveCommentsPerPostBeforeOpeningOrPaginatingThreads() throws Exception {
        Long emptyPost = newPost().getId();
        mvc.perform(get("/api/posts/" + emptyPost)).andExpect(jsonPath("$.commentCount").value(0));
        var root = service.create(owner.getId(), postId, new CommentService.CreateComment("원댓글", null));
        for (int i = 0; i < 20; i++) service.create(other.getId(), postId, new CommentService.CreateComment("댓글 " + i, null));
        var reply = service.create(other.getId(), postId, new CommentService.CreateComment("답글", Long.valueOf(root.id())));
        mvc.perform(get("/api/posts")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(emptyPost.toString())).andExpect(jsonPath("$.items[0].commentCount").value(0))
                .andExpect(jsonPath("$.items[1].id").value(postId.toString())).andExpect(jsonPath("$.items[1].commentCount").value(22));
        service.delete(other.getId(), postId, Long.valueOf(reply.id()));
        service.delete(owner.getId(), postId, Long.valueOf(root.id()));
        mvc.perform(get("/api/posts").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items[1].commentCount").value(20));
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.commentCount").value(20));
    }
}
