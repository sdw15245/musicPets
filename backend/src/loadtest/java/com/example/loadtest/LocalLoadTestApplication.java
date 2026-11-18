package com.example.loadtest;

import com.example.demo.DemoApplication;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Dedicated entry point; never included in the production bootJar. */
@Configuration(proxyBeanMethods = false)
public class LocalLoadTestApplication {
    public static void main(String[] args) {
        new SpringApplicationBuilder(DemoApplication.class, LocalLoadTestApplication.class)
                .profiles("loadtest").run(args);
    }

    @Bean RestClientCustomizer loadTestExternalStubs(ObjectMapper mapper) { return ExternalStubs.customizer(mapper); }

    @Bean ApplicationRunner loadTestSeed(JdbcTemplate db, ObjectMapper mapper) {
        return args -> {
            String url;
            try (var connection = db.getDataSource().getConnection()) {
                url = connection.getMetaData().getURL();
            }
            if (!url.startsWith("jdbc:mysql://mysql:3306/musicpets_loadtest"))
                throw new IllegalStateException("Fixtures require the isolated musicpets_loadtest database");
            if (db.queryForObject("select count(*) from users", Long.class) > 0) return;
            Timestamp time = Timestamp.from(Instant.parse("2026-11-12T00:00:00Z"));
            var users = new ArrayList<Object[]>();
            var tokens = new ArrayList<Object[]>();
            var characters = new ArrayList<Object[]>();
            for (int i = 1; i <= 200; i++) {
                users.add(new Object[]{i, time, "Fixture User " + i, "fixture-" + i, "mochi"});
                tokens.add(new Object[]{i, "fixture-spotify-access", Timestamp.from(Instant.parse("2099-01-01T00:00:00Z"))});
                characters.add(new Object[]{i, "mochi"});
            }
            db.batchUpdate("insert into users(id,created_at,display_name,spotify_id,analyzed_pet) values(?,?,?,?,?)", users);
            db.batchUpdate("insert into spotify_tokens(user_id,access_token,expires_at) values(?,?,?)", tokens);
            db.batchUpdate("insert into user_characters(user_id,character_slug) values(?,?)", characters);
            var posts = new ArrayList<Object[]>();
            var tags = new ArrayList<Object[]>();
            var comments = new ArrayList<Object[]>();
            var likes = new ArrayList<Object[]>();
            for (int i = 1; i <= 5000; i++) {
                int user = (i - 1) % 200 + 1;
                int likeCount = 2 * (i % 5);
                posts.add(new Object[]{i, "로컬 테스트 음악 " + i + (i % 5 == 0 ? " 산책" : " 작업"), time,
                    "Fixture Artist " + i % 5, "", "Fixture Track " + i, "spotify:track:fixture" + i, time, user, likeCount});
                tags.add(new Object[]{i, i % 5 == 0 ? "산책" : "작업", 0});
                tags.add(new Object[]{i, "인디", 1});
                for (int c = 0; c < 4; c++) {
                    comments.add(new Object[]{"Fixture comment " + c, time, false, (user + c) % 200 + 1, i});
                }
                for (int c = 0; c < likeCount; c++) likes.add(new Object[]{i, (user + c) % 200 + 1});
            }
            db.batchUpdate("insert into posts(id,caption,created_at,track_artist,track_image_url,track_name,track_uri,updated_at,author_id,like_count) values(?,?,?,?,?,?,?,?,?,?)", posts);
            db.batchUpdate("insert into post_tags(post_id,tag,tag_order) values(?,?,?)", tags);
            db.batchUpdate("insert into comments(body,created_at,deleted,author_id,post_id) values(?,?,?,?,?)", comments);
            db.batchUpdate("insert into post_likes(post_id,user_id) values(?,?)", likes);
            var histories = new ArrayList<Object[]>();
            var latest = new ArrayList<Object[]>();
            for (int user = 1; user <= 200; user++) {
                for (int h = 0; h < 10; h++) {
                    String id = "fixture-" + user + "-" + h;
                    var result = new com.example.demo.analysis.AnalysisResult(id, time.toInstant(),
                        new com.example.demo.analysis.AnalysisResult.Genres(Map.of("indie", .6, "r-and-b", .4), List.of(), 60, 20, "short_term"),
                        new com.example.demo.analysis.AnalysisResult.MatchedCharacter("mochi", "멜로", "Fixture", "/fixture.webp", .8),
                        new com.example.demo.analysis.AnalysisResult.Profile(50.0, 50.0, "테스트 취향 설명"),
                        List.of(), false, List.of(), null, false, false, List.of());
                    String json = mapper.writeValueAsString(result);
                    histories.add(new Object[]{id, json, user});
                    if (h == 9) latest.add(new Object[]{user, id, json});
                }
            }
            db.batchUpdate("insert into analysis_history(analysis_id,result_json,user_id) values(?,?,?)", histories);
            db.batchUpdate("insert into latest_analyses(user_id,analysis_id,result_json) values(?,?,?)", latest);
            System.out.println("LOADTEST_SEED_READY users=200 posts=5000 comments=20000 likes=20000 histories=2000");
        };
    }
}
