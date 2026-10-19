package com.sgh.patient.config;

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

    @Value("${patient.flyway.auto-run:true}")
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
                log.info("Attempting database connection and Flyway migrations...");
                try (Connection conn = dataSource.getConnection()) {
                    if (conn.isValid(2)) {
                        // The async thread's context class loader cannot see the migrations inside the
                        // packaged jar, so the class loader is passed explicitly.
                        Flyway flyway = Flyway.configure(DbReadyService.class.getClassLoader())
                                .dataSource(dataSource)
                                .locations("classpath:db/migration")
                                .baselineOnMigrate(true)
                                .load();
                        if (flyway.info().all().length == 0) {
                            throw new IllegalStateException("No Flyway migrations found on the classpath");
                        }
                        flyway.migrate();
                        ready = true;
                        log.info("Database migrations complete. Patient service is ready.");
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
