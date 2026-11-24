package com.example.demo.community;

import com.example.demo.user.User;

/**
 * 커뮤니티에서 실제로 일어난 활동. 알림처럼 다른 기능이 이 패키지를 호출하지 않고 듣도록 발행한다.
 * 같은 스레드·트랜잭션에서 동기로 전달되므로 리스너가 실패하면 활동도 함께 롤백된다.
 */
public sealed interface CommunityEvent {
    record PostLiked(Post post, User actor) implements CommunityEvent {}
    record PostUnliked(Long postId, Long actorId) implements CommunityEvent {}
    record PostDeleted(Long postId) implements CommunityEvent {}
    record CommentCreated(Comment comment) implements CommunityEvent {}
    record CommentDeleted(Long commentId) implements CommunityEvent {}
}
