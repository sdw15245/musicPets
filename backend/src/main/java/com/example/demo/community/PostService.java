package com.example.demo.community;

import com.example.demo.character.Character;
import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.spotify.SpotifyService.TrackHit;
import com.example.demo.spotify.TrackUri;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClientResponseException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PostService {
    private final PostRepository posts;
    private final CommentRepository comments;
    private final PostLikeRepository likes;
    private final UserRepository users;
    private final SpotifyService spotify;
    private final TransactionTemplate write;
    private final ApplicationEventPublisher events;

    public PostService(PostRepository posts, CommentRepository comments, PostLikeRepository likes, UserRepository users,
                       SpotifyService spotify, PlatformTransactionManager transactions, ApplicationEventPublisher events) {
        this.posts = posts; this.users = users; this.spotify = spotify;
        this.comments = comments;
        this.likes = likes;
        this.write = new TransactionTemplate(transactions);
        this.events = events;
    }

    public record EditPost(String trackUri, String caption, List<String> tags) {}
    public record PostView(String id, String author, String avatarSlug, String petSlug, TrackHit track,
                           String caption, List<String> tags, Instant createdAt, Instant updatedAt, boolean own, long likes, boolean liked, long commentCount) {}
    public record PostPage(List<PostView> items, int page, boolean hasMore) {}
    private record Draft(TrackUri track, String caption, List<String> tags) {}

    @Transactional(readOnly = true)
    public PostPage list(Long viewer, FeedQuery query) {
        PageRequest page = query.pageRequest();
        if (query.view() == FeedQuery.View.MINE && viewer == null) throw new ApiException(ErrorCode.UNAUTHORIZED);
        String selectedPet = query.filter() == FeedQuery.PetFilter.ALL ? null : selectedPet(viewer, query.pet());
        Slice<Post> result = posts.findBy(query.specification(viewer, selectedPet, Instant.now()), feed -> feed.slice(page));
        List<Long> postIds = result.stream().map(Post::getId).toList();
        Set<Long> likedIds = viewer == null || postIds.isEmpty() ? Set.of() : likes.findLikedPostIds(viewer, postIds);
        Map<Long, Long> commentCounts = postIds.isEmpty() ? Map.of() : comments.countForPosts(postIds).stream()
                .collect(Collectors.toMap(CommentRepository.PostCommentCount::getPostId, CommentRepository.PostCommentCount::getCommentCount));
        return new PostPage(result.map(post -> view(post, viewer, likedIds.contains(post.getId()), commentCounts.getOrDefault(post.getId(), 0L))).getContent(),
                query.page(), result.hasNext());
    }

    /** 같은/다른 펫 필터의 기준. 지정하지 않으면 내 분석 펫이며, 분석 전이면 필터를 쓸 수 없다. */
    private String selectedPet(Long viewer, String requested) {
        if (viewer == null) throw new ApiException(ErrorCode.UNAUTHORIZED);
        User user = users.findById(viewer).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        if (user.getAnalyzedPet() == null) throw new ApiException(ErrorCode.FORBIDDEN, "음악 취향 분석이 필요해요.");
        String pet = requested == null ? user.getAnalyzedPet() : requested;
        if (Character.POOL.stream().noneMatch(c -> c.slug().equals(pet))) {
            throw new ApiException(ErrorCode.INVALID_REQUEST, "펫을 확인해주세요.");
        }
        return pet;
    }

    @Transactional(readOnly = true)
    public PostView get(Long viewer, Long id) { return view(requirePost(id), viewer); }

    public PostView create(Long userId, EditPost request) {
        Draft draft = validate(request);
        TrackHit track = fetchTrack(userId, draft.track());
        // Spotify 응답을 받은 다음에만 DB 트랜잭션을 열어 연결을 오래 점유하지 않는다.
        return write.execute(status -> {
            User author = users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
            Post post = new Post(author);
            post.edit(track, draft.caption(), draft.tags());
            return view(posts.save(post), userId);
        });
    }

    public PostView update(Long userId, Long id, EditPost request) {
        Draft draft = validate(request);
        Post previous = requirePost(id);
        requireOwner(previous, userId);
        TrackHit track = previous.getTrack().uri().equals(draft.track().value()) ? previous.getTrack()
                : fetchTrack(userId, draft.track());
        return write.execute(status -> {
            Post post = posts.findForUpdate(id).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
            requireOwner(post, userId);
            post.edit(track, draft.caption(), draft.tags());
            return view(post, userId);
        });
    }

    public void delete(Long userId, Long id) {
        write.executeWithoutResult(status -> {
            Post post = posts.findForUpdate(id).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
            requireOwner(post, userId);
            events.publishEvent(new CommunityEvent.PostDeleted(id));
            comments.deleteRepliesByPostId(id);
            comments.deleteByPostId(id);
            likes.deleteByPostId(id);
            posts.delete(post);
        });
    }

    private TrackHit fetchTrack(Long userId, TrackUri track) {
        try {
            return spotify.getTrack(userId, track.id());
        } catch (RestClientResponseException e) {
            // 사용자가 고른 곡이 Spotify에 없으면 외부 장애가 아니라 잘못된 입력이다.
            if (e.getStatusCode().value() == 404) {
                throw new ApiException(ErrorCode.INVALID_REQUEST, "Spotify에서 이 곡을 찾지 못했어요. 다른 곡을 선택해주세요.");
            }
            throw e;
        }
    }

    private Post requirePost(Long id) { return posts.findById(id).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND)); }
    private void requireOwner(Post post, Long userId) {
        if (!post.getAuthor().getId().equals(userId)) throw new ApiException(ErrorCode.FORBIDDEN, "본인 글만 변경할 수 있어요.");
    }
    private Draft validate(EditPost request) {
        TrackUri track = TrackUri.parse(request.trackUri()).orElseThrow(this::badRequest);
        String caption = request.caption() == null ? "" : request.caption().strip();
        if (caption.isBlank() || caption.length() > 280 || request.tags() == null || request.tags().size() > 5) throw badRequest();
        var tags = new ArrayList<String>();
        for (String input : request.tags()) {
            if (input == null) throw badRequest();
            String tag = input.strip();
            if (tag.isBlank() || tag.length() > 30 || tag.codePoints().anyMatch(c -> c == '#' || java.lang.Character.isWhitespace(c) || java.lang.Character.isISOControl(c))) throw badRequest();
            if (!tags.contains(tag)) tags.add(tag);
        }
        return new Draft(track, caption, tags);
    }
    private ApiException badRequest() { return new ApiException(ErrorCode.INVALID_REQUEST, "곡·본문·태그를 확인해주세요."); }

    private PostView view(Post post, Long viewer) {
        return view(post, viewer, viewer != null && likes.existsByPostIdAndUserId(post.getId(), viewer), comments.countByPostIdAndDeletedFalse(post.getId()));
    }

    private PostView view(Post post, Long viewer, boolean liked, long commentCount) {
        User author = post.getAuthor();
        // 프론트의 이전 버전은 petSlug만 읽으므로 같은 값을 함께 보낸다.
        return new PostView(post.getId().toString(), author.publicName(), author.getAnalyzedPet(), author.getAnalyzedPet(), post.getTrack(),
                post.getCaption(), post.getTags(), post.getCreatedAt(), post.getUpdatedAt(), author.getId().equals(viewer), post.getLikes(), liked, commentCount);
    }
}
