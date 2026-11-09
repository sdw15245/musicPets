package com.example.demo.community;

import com.example.demo.character.Character;
import com.example.demo.spotify.SpotifyService;
import com.example.demo.spotify.SpotifyService.TrackHit;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class PostService {
    private final PostRepository posts;
    private final CommentRepository comments;
    private final PostLikeRepository likes;
    private final UserRepository users;
    private final SpotifyService spotify;
    private final TransactionTemplate write;
    private final com.example.demo.notification.NotificationService notifications;

    public PostService(PostRepository posts, CommentRepository comments, PostLikeRepository likes, UserRepository users, SpotifyService spotify, PlatformTransactionManager transactions, com.example.demo.notification.NotificationService notifications) {
        this.posts = posts; this.users = users; this.spotify = spotify;
        this.comments = comments;
        this.likes = likes;
        this.write = new TransactionTemplate(transactions);
        this.notifications = notifications;
    }

    public record EditPost(String trackUri, String caption, List<String> tags) {}
    public record PostView(String id, String author, String avatarSlug, String petSlug, TrackHit track,
                           String caption, List<String> tags, Instant createdAt, Instant updatedAt, boolean own, long likes, boolean liked, long commentCount) {}
    public record PostPage(List<PostView> items, int page, boolean hasMore) {}

    @Transactional(readOnly = true)
    public PostPage list(Long viewer, String view, String filter, String pet, int page, String sort, String q) {
        if (!List.of("all", "mine").contains(view) || !List.of("all", "same", "other").contains(filter)
                || page < 0 || page > 10000) throw badRequest();
        if (!List.of("latest", "popular").contains(sort)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "정렬 기준을 확인해주세요.");
        String search = q == null ? "" : q.strip();
        if (search.length() > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어는 100자 이내로 입력해주세요.");
        String term = search.replaceFirst("^#+", "").strip().toLowerCase(Locale.ROOT);
        String pattern = "%" + term.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        if (view.equals("mine") && viewer == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String filterPet = null;
        if (!filter.equals("all")) {
            if (viewer == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
            User user = users.findById(viewer).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
            if (user.getAnalyzedPet() == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "음악 취향 분석이 필요해요.");
            filterPet = pet == null ? user.getAnalyzedPet() : pet;
            String selected = filterPet;
            if (Character.POOL.stream().noneMatch(c -> c.slug().equals(selected))) throw badRequest();
        }
        String selectedPet = filterPet;
        Sort order = sort.equals("popular") ? Sort.by(Sort.Direction.DESC, "likes", "id") : Sort.by(Sort.Direction.DESC, "id");
        var result = posts.findAll((root, query, cb) -> {
            var conditions = new ArrayList<Predicate>();
            if (view.equals("mine")) conditions.add(cb.equal(root.get("author").get("id"), viewer));
            if (filter.equals("same")) conditions.add(cb.equal(root.get("author").get("analyzedPet"), selectedPet));
            if (filter.equals("other")) conditions.add(cb.notEqual(root.get("author").get("analyzedPet"), selectedPet));
            if (!term.isEmpty()) {
                var matchingTags = query.subquery(Integer.class);
                Join<Post, String> tag = matchingTags.correlate(root).join("tags");
                matchingTags.select(cb.literal(1)).where(cb.like(cb.lower(tag), pattern, '!'));
                conditions.add(cb.or(cb.like(cb.lower(root.get("caption")), pattern, '!'), cb.exists(matchingTags)));
            }
            return cb.and(conditions.toArray(Predicate[]::new));
        }, PageRequest.of(page, 20, order));
        List<Long> postIds = result.stream().map(Post::getId).toList();
        Set<Long> likedIds = viewer == null || postIds.isEmpty() ? Set.of() : likes.findLikedPostIds(viewer, postIds);
        Map<Long, Long> commentCounts = postIds.isEmpty() ? Map.of() : comments.countForPosts(postIds).stream()
                .collect(Collectors.toMap(CommentRepository.PostCommentCount::getPostId, CommentRepository.PostCommentCount::getCommentCount));
        return new PostPage(result.map(post -> view(post, viewer, likedIds.contains(post.getId()), commentCounts.getOrDefault(post.getId(), 0L))).getContent(), page, result.hasNext());
    }

    @Transactional(readOnly = true)
    public PostView get(Long viewer, Long id) { return view(requirePost(id), viewer); }

    public PostView create(Long userId, EditPost request) {
        EditPost clean = validate(request);
        TrackHit track = spotify.getTrack(userId, clean.trackUri().substring("spotify:track:".length()));
        // Spotify 응답을 받은 다음에만 DB 트랜잭션을 열어 연결을 오래 점유하지 않는다.
        return write.execute(status -> {
            User author = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
            Post post = new Post(author);
            post.edit(track, clean.caption(), clean.tags());
            return view(posts.save(post), userId);
        });
    }

    public PostView update(Long userId, Long id, EditPost request) {
        EditPost clean = validate(request);
        Post previous = requirePost(id);
        requireOwner(previous, userId);
        TrackHit track = previous.getTrack().uri().equals(clean.trackUri()) ? previous.getTrack()
                : spotify.getTrack(userId, clean.trackUri().substring("spotify:track:".length()));
        return write.execute(status -> {
            Post post = posts.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            requireOwner(post, userId);
            post.edit(track, clean.caption(), clean.tags());
            return view(post, userId);
        });
    }

    public void delete(Long userId, Long id) {
        write.executeWithoutResult(status -> {
            Post post = posts.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            requireOwner(post, userId);
            notifications.deletePost(id);
            comments.deleteRepliesByPostId(id);
            comments.deleteByPostId(id);
            likes.deleteByPostId(id);
            posts.delete(post);
        });
    }

    private Post requirePost(Long id) { return posts.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); }
    private void requireOwner(Post post, Long userId) {
        if (!post.getAuthor().getId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 글만 변경할 수 있어요.");
    }
    private EditPost validate(EditPost request) {
        if (request.trackUri() == null || !request.trackUri().matches("spotify:track:[A-Za-z0-9]{22}")) throw badRequest();
        String caption = request.caption() == null ? "" : request.caption().strip();
        if (caption.isBlank() || caption.length() > 280 || request.tags() == null || request.tags().size() > 5) throw badRequest();
        var tags = new ArrayList<String>();
        for (String input : request.tags()) {
            if (input == null) throw badRequest();
            String tag = input.strip();
            if (tag.isBlank() || tag.length() > 30 || tag.codePoints().anyMatch(c -> c == '#' || java.lang.Character.isWhitespace(c) || java.lang.Character.isISOControl(c))) throw badRequest();
            if (!tags.contains(tag)) tags.add(tag);
        }
        return new EditPost(request.trackUri(), caption, tags);
    }
    private ResponseStatusException badRequest() { return new ResponseStatusException(HttpStatus.BAD_REQUEST, "곡·본문·태그를 확인해주세요."); }

    private PostView view(Post post, Long viewer) {
        return view(post, viewer, viewer != null && likes.existsByPostIdAndUserId(post.getId(), viewer), comments.countByPostIdAndDeletedFalse(post.getId()));
    }

    private PostView view(Post post, Long viewer, boolean liked, long commentCount) {
        User author = post.getAuthor();
        String name = author.getNickname() != null ? author.getNickname() : author.getDisplayName();
        if (name == null || name.isBlank()) name = author.getSpotifyId();
        return new PostView(post.getId().toString(), name, author.getAnalyzedPet(), author.getAnalyzedPet(), post.getTrack(),
                post.getCaption(), post.getTags(), post.getCreatedAt(), post.getUpdatedAt(), author.getId().equals(viewer), post.getLikes(), liked, commentCount);
    }
}
