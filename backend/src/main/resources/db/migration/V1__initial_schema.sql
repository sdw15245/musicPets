-- Current MusicPets MySQL schema. Existing databases must be aligned and explicitly baselined.
-- Foreign-key creation order is intentional. Do not edit after adoption.

CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `spotify_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `analyzed_pet` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nickname` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKr15m7hxxj5kuhv03mb4voysxt` (`spotify_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `spotify_tokens` (
  `user_id` bigint NOT NULL,
  `access_token` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `refresh_token` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `expires_at` datetime(6) NOT NULL,
  `token` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_refresh_token` (`token`),
  KEY `idx_refresh_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tag_normalizations` (
  `tag` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `classified_at` datetime(6) NOT NULL,
  `main_genre` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_characters` (
  `user_id` bigint NOT NULL,
  `character_slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`user_id`,`character_slug`),
  CONSTRAINT `FKrbc83ct95gaoxhuv2t19dp05d` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `posts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `caption` varchar(280) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `track_artist` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `track_image_url` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `track_name` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `track_uri` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `author_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_posts_author_id` (`author_id`,`id`),
  CONSTRAINT `FK6xvn0811tkyo3nfjk2xvqx6ns` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `post_tags` (
  `post_id` bigint NOT NULL,
  `tag` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag_order` int NOT NULL,
  PRIMARY KEY (`post_id`,`tag_order`),
  CONSTRAINT `FKkifam22p4s1nm3bkmp1igcn5w` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `comments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `body` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `deleted` bit(1) NOT NULL,
  `author_id` bigint NOT NULL,
  `parent_id` bigint DEFAULT NULL,
  `post_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_comments_post_parent_id` (`post_id`,`parent_id`,`id`),
  KEY `FKn2na60ukhs76ibtpt9burkm27` (`author_id`),
  KEY `FKlri30okf66phtcgbe5pok7cc0` (`parent_id`),
  CONSTRAINT `FKh4c7lvsc298whoyd4w9ta25cr` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`),
  CONSTRAINT `FKlri30okf66phtcgbe5pok7cc0` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`),
  CONSTRAINT `FKn2na60ukhs76ibtpt9burkm27` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `post_likes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `post_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_like` (`post_id`,`user_id`),
  KEY `idx_post_likes_user` (`user_id`,`post_id`),
  CONSTRAINT `FKa5wxsgl4doibhbed9gm7ikie2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`),
  CONSTRAINT `FKkgau5n0nlewg6o9lr4yibqgxj` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `latest_analyses` (
  `user_id` bigint NOT NULL,
  `analysis_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `result_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `FK78665oedfaqr3gx02jqvfwuvk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `analysis_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `analysis_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `result_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKggerfwexcxqkus5svw3ar8nb7` (`user_id`,`analysis_id`),
  KEY `idx_history_user_id` (`user_id`,`id`),
  CONSTRAINT `FKdl8gp05mtw8ces7b8o578faw` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `saved_tracks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `artist` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_url` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `saved_at` datetime(6) NOT NULL,
  `track_uri` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKe4bcd67lw60dh1tqayegxlqja` (`user_id`,`track_uri`),
  KEY `idx_saved_tracks_user_id` (`user_id`,`id`),
  CONSTRAINT `FKcx0ean8m8542qi9nuvp7o86wr` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `activity_notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `comment_id` bigint DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `kind` enum('COMMENT','LIKE','REPLY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `post_id` bigint NOT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `source_id` bigint NOT NULL,
  `actor_id` bigint NOT NULL,
  `recipient_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKt1u2ml9cplxetw1ibm1qg7pb0` (`recipient_id`,`actor_id`,`kind`,`source_id`),
  KEY `idx_notification_recipient_id` (`recipient_id`,`id`),
  KEY `idx_notification_unread` (`recipient_id`,`read_at`),
  KEY `idx_notification_post` (`post_id`),
  KEY `idx_notification_comment` (`comment_id`),
  KEY `FKq062w36n9sktvue1gunbeknjd` (`actor_id`),
  CONSTRAINT `FKq062w36n9sktvue1gunbeknjd` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKtn5epfj4lm81erdkwm7v51lee` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
