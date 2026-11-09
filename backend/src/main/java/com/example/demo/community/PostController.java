package com.example.demo.community;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/posts")
public class PostController {
    private final PostService posts;
    private final PostLikeService likes;
    public PostController(PostService posts, PostLikeService likes) { this.posts = posts; this.likes = likes; }

    @GetMapping
    public PostService.PostPage list(@AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "all") String view, @RequestParam(defaultValue = "all") String filter,
            @RequestParam(required = false) String pet,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(defaultValue = "") String q) { return posts.list(userId, view, filter, pet, page, sort, q); }

    @PutMapping("/{id}/like")
    public PostLikeService.LikeView like(@AuthenticationPrincipal Long userId, @PathVariable Long id) { return likes.setLiked(userId, id, true); }

    @DeleteMapping("/{id}/like")
    public PostLikeService.LikeView unlike(@AuthenticationPrincipal Long userId, @PathVariable Long id) { return likes.setLiked(userId, id, false); }

    @GetMapping("/{id}")
    public PostService.PostView get(@AuthenticationPrincipal Long userId, @PathVariable Long id) { return posts.get(userId, id); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public PostService.PostView create(@AuthenticationPrincipal Long userId, @RequestBody PostService.EditPost request) { return posts.create(userId, request); }

    @PutMapping("/{id}")
    public PostService.PostView update(@AuthenticationPrincipal Long userId, @PathVariable Long id, @RequestBody PostService.EditPost request) { return posts.update(userId, id, request); }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long userId, @PathVariable Long id) { posts.delete(userId, id); }
}
