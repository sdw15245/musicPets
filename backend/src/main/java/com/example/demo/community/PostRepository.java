package com.example.demo.community;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long>, JpaSpecificationExecutor<Post> {
    interface NotificationPostPreview { Long getId(); String getTrackName(); String getTrackArtist(); }
    @Query("select p.id as id, p.trackName as trackName, p.trackArtist as trackArtist from Post p where p.id in :ids")
    List<NotificationPostPreview> notificationPreviews(@Param("ids") List<Long> ids);
    @EntityGraph(attributePaths = "author")
    Page<Post> findAll(Specification<Post> spec, Pageable pageable);

    @EntityGraph(attributePaths = "author")
    Optional<Post> findById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Post p join fetch p.author where p.id = :id")
    Optional<Post> findForUpdate(@Param("id") Long id);
}
