package com.example.demo.community;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/posts/{postId}/comments")
public class CommentController {
    private final CommentService comments;
    public CommentController(CommentService comments) { this.comments = comments; }

    @GetMapping
    public CommentService.CommentPage list(@AuthenticationPrincipal Long userId, @PathVariable Long postId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(required = false) Long focus) { return comments.list(userId, postId, page, focus); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public CommentService.CommentView create(@AuthenticationPrincipal Long userId, @PathVariable Long postId,
            @RequestBody CommentService.CreateComment request) { return comments.create(userId, postId, request); }

    @PutMapping("/{id}")
    public CommentService.CommentView update(@AuthenticationPrincipal Long userId, @PathVariable Long postId,
            @PathVariable Long id, @RequestBody CommentService.EditComment request) { return comments.update(userId, postId, id, request); }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long userId, @PathVariable Long postId, @PathVariable Long id) { comments.delete(userId, postId, id); }
}
