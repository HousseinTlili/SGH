package com.sgh.staff.config;

import jakarta.annotation.PostConstruct;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.concurrent.CompletableFuture;

@Service
public class DbReadyService {

    private static final Logger log = LoggerFactory.getLogger(DbReadyService.class);

    private final DataSource dataSource;

    @Value("${staff.flyway.auto-run:true}")
    private boolean autoRunFlyway;

    private volatile boolean ready = false;

    public DbReadyService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @PostConstruct
    public void init() {
        if (!autoRunFlyway) {
            ready = true;
            return;
        }

        CompletableFuture.runAsync(this::connectAndMigrateWithRetry);
    }

    public void connectAndMigrateWithRetry() {
        int[] delays = {1000, 2000, 4000, 8000, 16000, 30000};
        int attempt = 0;

        while (!ready) {
            try {
                log.info("Attempting database connection and Flyway migrations for sgh_staff...");
                try (Connection conn = dataSource.getConnection()) {
                    if (conn.isValid(2)) {
                        Flyway flyway = Flyway.configure()
                                .dataSource(dataSource)
                                .baselineOnMigrate(true)
                                .load();
                        flyway.migrate();
                        ready = true;
                        log.info("Database migrations complete. Staff service is ready.");
                        return;
                    }
                }
            } catch (Exception e) {
                int delay = delays[Math.min(attempt, delays.length - 1)];
                log.warn("Database not ready (attempt {}): {}. Retrying in {}ms...", attempt + 1, e.getMessage(), delay);
                attempt++;
                try {
                    Thread.sleep(delay);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }
}
