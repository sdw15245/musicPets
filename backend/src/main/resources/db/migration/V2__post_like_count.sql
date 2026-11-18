ALTER TABLE posts ADD COLUMN like_count BIGINT NOT NULL DEFAULT 0;

UPDATE posts p
JOIN (SELECT post_id, COUNT(*) AS total FROM post_likes GROUP BY post_id) l
    ON l.post_id = p.id
SET p.like_count = l.total;

CREATE INDEX idx_posts_popular ON posts (like_count, created_at, id);
