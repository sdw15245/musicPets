package com.example.demo.migration;

import org.flywaydb.core.Flyway;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** Explicit adoption command, excluded from the application jar. Never changes application tables. */
public final class ExistingDatabaseBaseline {
    private ExistingDatabaseBaseline() {}

    public static void main(String[] args) throws Exception {
        String url = required("DB_URL"), user = required("DB_USERNAME"), password = System.getenv("DB_PASSWORD");
        try (var connection = DriverManager.getConnection(url, user, password == null ? "" : password)) {
            verifySchema(connection);
        }
        System.out.println("Existing MySQL schema matches V1 (13 tables). No application data changed.");
        if (args.length == 0) {
            System.out.println("Check only. Supply -PbaselineBackup=<verified backup path> to register baseline V1.");
            return;
        }
        Path backup = Path.of(args[0]);
        if (!Files.isRegularFile(backup) || Files.size(backup) == 0)
            throw new IllegalArgumentException("A non-empty, verified backup file is required");
        var flyway = Flyway.configure().dataSource(url, user, password == null ? "" : password)
                .baselineVersion("1").baselineDescription("Existing schema aligned with V1")
                .baselineOnMigrate(false).cleanDisabled(true).load();
        flyway.baseline();
        flyway.validate();
        System.out.println("Baseline V1 registered. Future changes must use new versioned migrations.");
    }

    public static void verifySchema(Connection connection) throws Exception {
        Map<String, String> expected = new LinkedHashMap<>();
        try (var input = ExistingDatabaseBaseline.class.getResourceAsStream("/db/migration/V1__initial_schema.sql")) {
            if (input == null) throw new IllegalStateException("Missing V1 migration");
            var matcher = Pattern.compile("CREATE TABLE `([a-z_]+)` \\(.*?;", Pattern.DOTALL)
                    .matcher(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            while (matcher.find()) expected.put(matcher.group(1), normalize(matcher.group()));
        }
        if (expected.size() != 13) throw new IllegalStateException("Unexpected V1 table count");
        Map<String, String> actual = new LinkedHashMap<>();
        try (var statement = connection.createStatement(); var tables = statement.executeQuery("SHOW FULL TABLES")) {
            while (tables.next()) {
                String table = tables.getString(1);
                if (table.equals("flyway_schema_history")) continue;
                if (!expected.containsKey(table) || !tables.getString(2).equals("BASE TABLE"))
                    throw new IllegalStateException("Unexpected table/view: " + table);
                actual.put(table, "");
            }
        }
        if (!actual.keySet().equals(expected.keySet())) throw new IllegalStateException("Existing tables do not match V1");
        for (String table : actual.keySet()) {
            try (var statement = connection.createStatement(); var ddl = statement.executeQuery("SHOW CREATE TABLE `" + table + "`")) {
                ddl.next();
                String actualDdl = normalize(ddl.getString(2));
                if (!actualDdl.equals(expected.get(table))) {
                    String expectedDdl = expected.get(table);
                    int at = 0;
                    while (at < Math.min(actualDdl.length(), expectedDdl.length()) && actualDdl.charAt(at) == expectedDdl.charAt(at)) at++;
                    throw new IllegalStateException("Schema differs from V1: " + table + " at " + at
                            + ". Expected: " + expectedDdl.substring(at, Math.min(at + 100, expectedDdl.length()))
                            + "; actual: " + actualDdl.substring(at, Math.min(at + 100, actualDdl.length())));
                }
            }
        }
    }

    private static String normalize(String ddl) {
        // SHOW CREATE may spell out the charset already implied by the same collation.
        // Keep the collation itself so a real encoding/ordering change still fails validation.
        return ddl.replace(" CHARACTER SET utf8mb4 COLLATE utf8mb4_", " COLLATE utf8mb4_")
                .replaceAll(" AUTO_INCREMENT=\\d+", "").replace("\r\n", "\n").strip().replaceAll(";$", "");
    }

    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing environment variable: " + key);
        return value;
    }
}
