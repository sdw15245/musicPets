package com.example.demo.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.sql.*;
import java.nio.file.*;
import java.util.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import static org.assertj.core.api.Assertions.*;

@Tag("mysql")
@Testcontainers
class MySqlMigrationTest {
    @Container static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0.43");

    private Flyway flyway() { return Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load(); }
    private Connection connection() throws SQLException { return DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()); }

    @BeforeEach void resetIsolatedDatabase() {
        // This URL only comes from the disposable Testcontainers instance, never DB_URL/.env.
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).cleanDisabled(false).load().clean();
    }

    @Test void emptyDatabaseGetsAllTablesAndRestartDoesNotRepeatMigration() throws Exception {
        var flyway = Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(4);
        try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
             var statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME <> 'flyway_schema_history'")) {
            rows.next(); assertThat(rows.getInt(1)).isEqualTo(13);
        }
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
    }

    @Test void legacySchemaMustBeAlignedBeforeBaselineAndExistingDataSurvivesUpgrade() throws Exception {
        var source = new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
        new ResourceDatabasePopulator(new ClassPathResource("db/legacy-schema.sql")).execute(source);
        try (var connection = connection(); var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO users(id,created_at,spotify_id,nickname,avatar) VALUES(1,NOW(6),'test-spotify','음악 친구','legacy-avatar')");
            statement.executeUpdate("INSERT INTO posts(id,caption,created_at,track_artist,track_image_url,track_name,track_uri,updated_at,author_id) VALUES(1,'기록',NOW(6),'artist','','song','spotify:track:test',NOW(6),1)");
            statement.executeUpdate("INSERT INTO posts(id,caption,created_at,track_artist,track_image_url,track_name,track_uri,updated_at,author_id) VALUES(2,'새 글',NOW(6),'artist','','song','spotify:track:other',NOW(6),1)");
            statement.executeUpdate("INSERT INTO post_likes(post_id,user_id) VALUES(1,1)");
            statement.executeUpdate("INSERT INTO analysis_history(analysis_id,result_json,user_id) VALUES('existing','{\"saved\":true}',1)");
            assertThatThrownBy(() -> ExistingDatabaseBaseline.verifySchema(connection)).hasMessageContaining("users");
            assertThatThrownBy(() -> flyway().migrate()).isInstanceOf(org.flywaydb.core.api.FlywayException.class);
            statement.executeUpdate("ALTER TABLE users DROP COLUMN avatar");
            ExistingDatabaseBaseline.verifySchema(connection);
        }
        var flyway = flyway(); flyway.baseline();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(3);
        try (var connection = connection(); var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("SELECT nickname FROM users WHERE id=1")) { rows.next(); assertThat(rows.getString(1)).isEqualTo("음악 친구"); }
            try (var rows = statement.executeQuery("SELECT result_json FROM analysis_history WHERE analysis_id='existing'")) { rows.next(); assertThat(rows.getString(1)).isEqualTo("{\"saved\":true}"); }
            try (var rows = statement.executeQuery("SELECT like_count FROM posts WHERE author_id=1 ORDER BY id")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getLong(1)).isEqualTo(1);
                assertThat(rows.next()).isTrue(); assertThat(rows.getLong(1)).isZero();
                assertThat(rows.next()).isFalse();
            }
            assertThatThrownBy(() -> statement.executeUpdate("INSERT INTO users(created_at,spotify_id) VALUES(NOW(6),'test-spotify')")).isInstanceOf(SQLException.class);
        }
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }

    @Test void latestResultsWithoutHistoryAreBackfilledOnceWithoutDuplicates() throws Exception {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("2").load().migrate();
        try (var connection = connection(); var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO users(id,created_at,spotify_id) VALUES(1,NOW(6),'legacy'),(2,NOW(6),'recorded')");
            // 기록 기능 이전 사용자: 최신 결과만 있다.
            statement.executeUpdate("INSERT INTO latest_analyses(user_id,analysis_id,result_json) VALUES(1,'old-run','{\"id\":\"old-run\"}')");
            // 기록 기능 이후 사용자: 최신 결과가 이미 기록에 있다.
            statement.executeUpdate("INSERT INTO latest_analyses(user_id,analysis_id,result_json) VALUES(2,'new-run','{\"id\":\"new-run\"}')");
            statement.executeUpdate("INSERT INTO analysis_history(analysis_id,result_json,user_id) VALUES('new-run','{\"id\":\"new-run\"}',2)");
        }
        assertThat(Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
                .target("3").load().migrate().migrationsExecuted).isEqualTo(1);
        try (var connection = connection(); var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("SELECT user_id, analysis_id, result_json FROM analysis_history ORDER BY user_id")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getLong(1)).isEqualTo(1);
                assertThat(rows.getString(2)).isEqualTo("old-run");
                assertThat(rows.getString(3)).isEqualTo("{\"id\":\"old-run\"}");
                assertThat(rows.next()).isTrue();
                assertThat(rows.getLong(1)).isEqualTo(2);
                assertThat(rows.next()).as("existing record is not duplicated").isFalse();
            }
        }
    }

    @Test void storedRefreshTokensAreHashedInPlaceSoExistingSessionsSurvive() throws Exception {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("3").load().migrate();
        String raw = "header.payload.signature-of-an-existing-session";
        try (var connection = connection(); var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO users(id,created_at,spotify_id) VALUES(1,NOW(6),'session-owner')");
            statement.executeUpdate("INSERT INTO refresh_tokens(expires_at,token,user_id) VALUES(NOW(6),'" + raw + "',1)");
        }
        assertThat(flyway().migrate().migrationsExecuted).isEqualTo(1);
        try (var connection = connection(); var statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT token FROM refresh_tokens WHERE user_id=1")) {
            assertThat(rows.next()).isTrue();
            // 앱이 쿠키 값으로 계산하는 해시와 같아야 기존 로그인이 유지된다.
            assertThat(rows.getString(1)).isEqualTo(com.example.demo.auth.RefreshToken.hash(raw)).isNotEqualTo(raw);
        }
    }

    @Test void schemaCheckRejectsMissingIndexesAndUnexpectedTables() throws Exception {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).target("1").load().migrate();
        try (var connection = connection(); var statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE unexpected(id BIGINT)");
            assertThatThrownBy(() -> ExistingDatabaseBaseline.verifySchema(connection)).hasMessageContaining("Unexpected table");
            statement.executeUpdate("DROP TABLE unexpected");
            statement.executeUpdate("ALTER TABLE users DROP INDEX UKr15m7hxxj5kuhv03mb4voysxt");
            assertThatThrownBy(() -> ExistingDatabaseBaseline.verifySchema(connection)).hasMessageContaining("users");
        }
    }

    @Test void flywaySchemaPassesJpaValidationAndRepositoryRoundTrip() {
        try (var context = new org.springframework.boot.builder.SpringApplicationBuilder(com.example.demo.DemoApplication.class).run(
                "--server.port=0", "--spring.datasource.url=" + MYSQL.getJdbcUrl(), "--spring.datasource.username=" + MYSQL.getUsername(),
                "--spring.datasource.password=" + MYSQL.getPassword(), "--spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver",
                "--spring.jpa.hibernate.ddl-auto=validate", "--spring.jpa.show-sql=false", "--spring.flyway.enabled=true",
                "--spring.security.oauth2.client.registration.spotify.client-id=test", "--spring.security.oauth2.client.registration.spotify.client-secret=test",
                "--lastfm.api-key=test", "--gemini.api-key=test", "--app.music-cache.enabled=false", "--app.rate-limit.enabled=false",
                "--jwt.secret=test-secret-test-secret-test-secret-test-secret-test-secret")) {
            var users = context.getBean(com.example.demo.user.UserRepository.class);
            var saved = users.save(new com.example.demo.user.User("round-trip", "", "음악 친구"));
            assertThat(users.findById(saved.getId()).orElseThrow().getDisplayName()).isEqualTo("음악 친구");
        }
    }

    @Test void changedMigrationChecksumIsRejected() throws Exception {
        var directory = Files.createTempDirectory("musicpets-migrations-");
        try {
            var migration = directory.resolve("V1__example.sql");
            Files.writeString(migration, "CREATE TABLE checksum_test(id BIGINT PRIMARY KEY);");
            var flyway = Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
                    .locations("filesystem:" + directory).load();
            flyway.migrate();
            Files.writeString(migration, "CREATE TABLE checksum_test(id INT PRIMARY KEY);");
            assertThat(flyway.validateWithResult().validationSuccessful).isFalse();
        } finally {
            Files.deleteIfExists(directory.resolve("V1__example.sql")); Files.deleteIfExists(directory);
        }
    }
}
