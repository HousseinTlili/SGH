package com.sgh.patient;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

/** Creates the throwaway test database on first use (Postgres has no CREATE DATABASE IF NOT EXISTS). */
final class TestDatabase {

    private static final String NAME = "sgh_patient_test";
    private static boolean ready;

    private TestDatabase() {
    }

    static synchronized void ensure() {
        if (ready) {
            return;
        }
        String adminUrl = System.getenv().getOrDefault("TEST_DATABASE_ADMIN_URL", "jdbc:postgresql://localhost:5432/postgres");
        String user = System.getenv().getOrDefault("DATABASE_USERNAME", "sgh");
        String password = System.getenv().getOrDefault("DATABASE_PASSWORD", "sgh_dev_password");
        try (Connection connection = DriverManager.getConnection(adminUrl, user, password);
             Statement statement = connection.createStatement()) {
            try (ResultSet rs = statement.executeQuery("SELECT 1 FROM pg_database WHERE datname = '" + NAME + "'")) {
                if (!rs.next()) {
                    statement.execute("CREATE DATABASE " + NAME);
                }
            }
            ready = true;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot prepare test database " + NAME + " (is PostgreSQL running?)", e);
        }
    }
}
