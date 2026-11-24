package com.example.demo.community;

import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;
import com.example.demo.paging.Paging;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Locale;

/**
 * 게시글 피드 조회 조건. 요청 파라미터 문자열은 parse에서 한 번만 검증한다.
 * 펫 필터(SAME/OTHER)가 비교할 펫은 로그인 사용자 정보가 필요해 PostService가 정한다.
 */
public record FeedQuery(View view, PetFilter filter, String pet, int page, Order order, String term) {
    public enum View { ALL, MINE }
    public enum PetFilter { ALL, SAME, OTHER }
    public enum Order { LATEST, POPULAR }

    private static final int MAX_SEARCH_LENGTH = 100;

    static FeedQuery parse(String view, String filter, String pet, int page, String sort, String q) {
        String search = q == null ? "" : q.strip();
        if (search.length() > MAX_SEARCH_LENGTH) {
            throw new ApiException(ErrorCode.INVALID_REQUEST, "검색어는 100자 이내로 입력해주세요.");
        }
        // 태그 검색처럼 앞에 붙인 #은 무시한다.
        String term = search.replaceFirst("^#+", "").strip().toLowerCase(Locale.ROOT);
        return new FeedQuery(option(View.class, view, "보기 범위를 확인해주세요."),
                option(PetFilter.class, filter, "펫 필터를 확인해주세요."), pet, page,
                option(Order.class, sort, "정렬 기준을 확인해주세요."), term);
    }

    /** 파라미터는 소문자 이름(all, mine, same, other, latest, popular)만 받는다. */
    private static <E extends Enum<E>> E option(Class<E> type, String value, String message) {
        for (E option : type.getEnumConstants()) {
            if (option.name().toLowerCase(Locale.ROOT).equals(value)) return option;
        }
        throw new ApiException(ErrorCode.INVALID_REQUEST, message);
    }

    PageRequest pageRequest() {
        Sort sort = order == Order.POPULAR
                ? Sort.by(Sort.Direction.DESC, "likes", "createdAt", "id")
                : Sort.by(Sort.Direction.DESC, "id");
        return Paging.of(page, sort);
    }

    /**
     * @param selectedPet filter가 ALL이 아닐 때 비교할 펫
     * @param now         인기순의 최근 7일 기준 시각
     */
    Specification<Post> specification(Long viewer, String selectedPet, Instant now) {
        String pattern = "%" + term.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        return (root, query, cb) -> {
            root.fetch("author");
            var conditions = new ArrayList<Predicate>();
            if (order == Order.POPULAR) {
                // 인기순은 최근 7일 안에 공감을 받은 글만 보여준다.
                conditions.add(cb.between(root.get("createdAt"), now.minus(7, ChronoUnit.DAYS), now));
                conditions.add(cb.gt(root.get("likes"), 0L));
            }
            if (view == View.MINE) conditions.add(cb.equal(root.get("author").get("id"), viewer));
            if (filter == PetFilter.SAME) conditions.add(cb.equal(root.get("author").get("analyzedPet"), selectedPet));
            if (filter == PetFilter.OTHER) conditions.add(cb.notEqual(root.get("author").get("analyzedPet"), selectedPet));
            if (!term.isEmpty()) {
                var matchingTags = query.subquery(Integer.class);
                Join<Post, String> tag = matchingTags.correlate(root).join("tags");
                matchingTags.select(cb.literal(1)).where(cb.like(cb.lower(tag), pattern, '!'));
                conditions.add(cb.or(cb.like(cb.lower(root.get("caption")), pattern, '!'), cb.exists(matchingTags)));
            }
            return cb.and(conditions.toArray(Predicate[]::new));
        };
    }
}
