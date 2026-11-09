package com.example.demo.community;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.spotify.SpotifyService.TrackHit;
import com.example.demo.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @ActiveProfiles("test") @AutoConfigureMockMvc
class ActivityNotificationTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PostRepository posts;
    @Autowired PostLikeService likes;
    @Autowired CommentService comments;
    @Autowired PostService postService;
    @Autowired JwtTokenProvider tokens;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    User user() { return users.save(new User(UUID.randomUUID().toString(), "", "친구")); }
    String auth(User user) { return "Bearer " + tokens.createAccessToken(user.getId()); }
    Post post(User owner) {
        Post post = new Post(owner);
        post.edit(new TrackHit("spotify:track:5VBjyOQzqlPNgdRPMM6prF", "곡", "가수", ""), "음악", List.of());
        return posts.save(post);
    }
    @Test void likesAreIdempotentPrivateAndRetractedWithUnlike() throws Exception {
        User owner = user(), actor = user();
        Post post = post(owner);
        likes.setLiked(owner.getId(), post.getId(), true);
        likes.setLiked(actor.getId(), post.getId(), true);
        likes.setLiked(actor.getId(), post.getId(), true);
        var response = mvc.perform(get("/api/notifications").header("Authorization", auth(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].kind").value("LIKE")).andExpect(jsonPath("$.unreadCount").value(1)).andReturn();
        String id = mapper.readTree(response.getResponse().getContentAsString()).at("/items/0/id").asText();
        mvc.perform(put("/api/notifications/" + id + "/read").header("Authorization", auth(actor))).andExpect(status().isNotFound());
        mvc.perform(put("/api/notifications/" + id + "/read").header("Authorization", auth(owner))).andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", auth(owner))).andExpect(jsonPath("$.count").value(0));
        likes.setLiked(actor.getId(), post.getId(), false);
        mvc.perform(get("/api/notifications").header("Authorization", auth(owner))).andExpect(jsonPath("$.items.length()").value(0));
    }
    @Test void repliesNotifyCommentOwnerOnceAndDeletionCleansActivity() throws Exception {
        User owner = user(), commenter = user(), replier = user();
        Post post = post(owner);
        var root = comments.create(commenter.getId(), post.getId(), new CommentService.CreateComment("좋아요", null));
        var reply = comments.create(replier.getId(), post.getId(), new CommentService.CreateComment("저도요", Long.valueOf(root.id())));
        mvc.perform(get("/api/notifications").header("Authorization", auth(commenter)))
            .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].kind").value("REPLY"))
            .andExpect(jsonPath("$.items[0].postPreview").value("곡 · 가수"))
            .andExpect(jsonPath("$.items[0].commentPreview").value("저도요"));
        mvc.perform(get("/api/notifications").header("Authorization", auth(owner))).andExpect(jsonPath("$.items.length()").value(2));
        mvc.perform(put("/api/notifications/read").header("Authorization", auth(owner))).andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", auth(owner))).andExpect(jsonPath("$.count").value(0));
        comments.delete(replier.getId(), post.getId(), Long.valueOf(reply.id()));
        mvc.perform(get("/api/notifications").header("Authorization", auth(commenter))).andExpect(jsonPath("$.items.length()").value(0));
        postService.delete(owner.getId(), post.getId());
        mvc.perform(get("/api/notifications").header("Authorization", auth(owner))).andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(get("/api/notifications")).andExpect(status().isUnauthorized());
    }

    @Test void replyToPostAuthorsCommentProducesOneNotificationAndFailedWriteRollsBack() throws Exception {
        User owner = user(), actor = user();
        Post post = post(owner);
        var root = comments.create(owner.getId(), post.getId(), new CommentService.CreateComment("내 댓글", null));
        comments.create(actor.getId(), post.getId(), new CommentService.CreateComment("답글", Long.valueOf(root.id())));
        mvc.perform(get("/api/notifications").header("Authorization", auth(owner)))
            .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].kind").value("REPLY"));
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            new org.springframework.transaction.support.TransactionTemplate(transactions).executeWithoutResult(status -> {
                comments.create(actor.getId(), post.getId(), new CommentService.CreateComment("롤백될 댓글", null));
                throw new IllegalStateException("rollback");
            })).isInstanceOf(IllegalStateException.class);
        mvc.perform(get("/api/notifications").header("Authorization", auth(owner))).andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test void notificationPagesRemainOrderedAndReadAllDoesNotReadFutureEvents() throws Exception {
        User owner = user(), actor = user();
        Post post = post(owner);
        for (int i = 0; i < 21; i++) comments.create(actor.getId(), post.getId(), new CommentService.CreateComment("댓글 " + i, null));
        mvc.perform(get("/api/notifications").header("Authorization", auth(owner)))
            .andExpect(jsonPath("$.items.length()").value(20)).andExpect(jsonPath("$.hasMore").value(true)).andExpect(jsonPath("$.unreadCount").value(21));
        mvc.perform(get("/api/notifications?page=1").header("Authorization", auth(owner)))
            .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(put("/api/notifications/read").header("Authorization", auth(owner))).andExpect(status().isNoContent());
        comments.create(actor.getId(), post.getId(), new CommentService.CreateComment("새 댓글", null));
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", auth(owner))).andExpect(jsonPath("$.count").value(1));
    }
}
