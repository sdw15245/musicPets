package com.example.demo.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.MountableFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

@Tag("backup")
class MySqlBackupRestoreTest {
    @Test void privateBackupRestoresAndRetainedDataIsUnchangedAfterAlignmentAndBaseline() throws Exception {
        Path backup = Path.of(Objects.requireNonNull(System.getProperty("migration.backup"), "Supply -Pbackup=<SQL backup path>"));
        assertThat(Files.size(backup)).isPositive();
        try (var mysql = new MySQLContainer<>("mysql:8.0.43")) {
            mysql.start();
            mysql.copyFileToContainer(MountableFile.forHostPath(backup), "/tmp/musicpets-backup.sql");
            var restore = mysql.execInContainer("sh", "-c", "mysql -utest -ptest test < /tmp/musicpets-backup.sql");
            // Never print dump contents, SQL errors or restored user/token values.
            assertThat(restore.getExitCode()).as("Backup restore exit code (private output suppressed)").isZero();
            try (var connection = DriverManager.getConnection(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword())) {
                var before = fingerprints(connection);
                try (var statement = connection.createStatement()) { statement.executeUpdate("ALTER TABLE users DROP COLUMN avatar"); }
                ExistingDatabaseBaseline.verifySchema(connection);
                var flyway = Flyway.configure().dataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword()).cleanDisabled(true).load();
                flyway.baseline();
                assertThat(flyway.migrate().migrationsExecuted).isZero();
                assertThat(fingerprints(connection)).isEqualTo(before);
                assertThat(before).hasSize(13);
            }
        }
    }

    private Map<String, String> fingerprints(Connection connection) throws Exception {
        Map<String, String> fingerprints = new TreeMap<>();
        List<String> tables = new ArrayList<>();
        try (var statement = connection.createStatement(); var rows = statement.executeQuery("SHOW TABLES")) {
            while (rows.next()) if (!rows.getString(1).equals("flyway_schema_history")) tables.add(rows.getString(1));
        }
        for (String table : tables) {
            if (!table.matches("[a-z_]+")) throw new IllegalStateException("Unexpected table identifier");
            List<String> columns = new ArrayList<>();
            try (var statement = connection.createStatement(); var rows = statement.executeQuery("SHOW COLUMNS FROM `" + table + "`")) {
                while (rows.next()) if (!table.equals("users") || !rows.getString(1).equals("avatar")) columns.add("`" + rows.getString(1) + "`");
            }
            List<String> hashes = new ArrayList<>();
            try (var statement = connection.createStatement(); var rows = statement.executeQuery("SELECT " + String.join(",", columns) + " FROM `" + table + "`")) {
                while (rows.next()) {
                    var digest = MessageDigest.getInstance("SHA-256");
                    for (int i = 1; i <= columns.size(); i++) {
                        byte[] bytes = rows.getBytes(i);
                        digest.update((bytes == null ? "null:" : bytes.length + ":").getBytes(StandardCharsets.UTF_8));
                        if (bytes != null) digest.update(bytes);
                    }
                    hashes.add(HexFormat.of().formatHex(digest.digest()));
                }
            }
            Collections.sort(hashes);
            fingerprints.put(table, hashes.size() + ":" + String.join(",", hashes));
        }
        return fingerprints;
    }
}
