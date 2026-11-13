package com.sgh.patient;

import com.sgh.patient.config.DbReadyService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/patients/staff/{staffId}: the OpenFeign call to Staff service, against a stub Staff
 * service started in this test (JDK HttpServer, no extra dependency).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StaffLookupFeignTest {

    private static final String FOUND = "b2b2b2b2-0000-4000-8000-000000000001";
    private static final String UNKNOWN = "b2b2b2b2-0000-4000-8000-000000000999";
    private static final String SLOW = "b2b2b2b2-0000-4000-8000-000000000500";
    private static final String BROKEN = "b2b2b2b2-0000-4000-8000-000000000503";

    private static final HttpServer STAFF_STUB;
    private static final AtomicReference<String> lastAuthorization = new AtomicReference<>();
    private static final AtomicReference<String> lastCorrelationId = new AtomicReference<>();

    static {
        TestDatabase.ensure();
        try {
            STAFF_STUB = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        STAFF_STUB.createContext("/api/staff/", exchange -> {
            lastAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            lastCorrelationId.set(exchange.getRequestHeaders().getFirst("X-Correlation-Id"));
            String path = exchange.getRequestURI().getPath();
            int code;
            String body;
            if (path.equals("/api/staff/" + FOUND + "/public")) {
                code = 200;
                body = "{\"id\":\"" + FOUND + "\",\"fullName\":\"Amel Trabelsi\",\"role\":\"DOCTOR\",\"specialty\":\"Cardiology\"}";
            } else if (path.equals("/api/staff/" + SLOW + "/public")) {
                try {
                    Thread.sleep(3000); // longer than the 2 s read timeout
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                code = 200;
                body = "{}";
            } else if (path.equals("/api/staff/" + BROKEN + "/public")) {
                code = 503;
                body = "{\"status\":503,\"error\":\"Service Unavailable\",\"message\":\"Database unavailable\"}";
            } else {
                code = 404;
                body = "{\"status\":404,\"error\":\"Not Found\",\"message\":\"Staff member not found\"}";
            }
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(code, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });
        STAFF_STUB.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        STAFF_STUB.start();
    }

    @DynamicPropertySource
    static void staffUrl(DynamicPropertyRegistry registry) {
        registry.add("staff-service.url", () -> "http://127.0.0.1:" + STAFF_STUB.getAddress().getPort());
    }

    @AfterAll
    static void stopStub() {
        STAFF_STUB.stop(0);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DbReadyService dbReadyService;

    @BeforeEach
    void setUp() {
        dbReadyService.setReady(true);
        lastAuthorization.set(null);
        lastCorrelationId.set(null);
    }

    private static SimpleGrantedAuthority role(String name) {
        return new SimpleGrantedAuthority("ROLE_" + name);
    }

    @Test
    @DisplayName("Found: Feign returns the staff profile and forwards the token and X-Correlation-Id")
    void foundForwardsHeaders() throws Exception {
        mockMvc.perform(get("/api/patients/staff/" + FOUND)
                        .header("X-Correlation-Id", "feign-test-1")
                        .with(jwt().jwt(j -> j.tokenValue("test-token")).authorities(role("DOCTOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.staffId").value(FOUND))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.fullName").value("Amel Trabelsi"))
                .andExpect(jsonPath("$.role").value("DOCTOR"))
                .andExpect(jsonPath("$.specialty").value("Cardiology"))
                .andExpect(jsonPath("$.source").value("staff-service"));

        assertThat(lastAuthorization.get()).isEqualTo("Bearer test-token");
        assertThat(lastCorrelationId.get()).isEqualTo("feign-test-1");
    }

    @Test
    @DisplayName("Staff service 404 gives 404")
    void unknownStaffIs404() throws Exception {
        mockMvc.perform(get("/api/patients/staff/" + UNKNOWN).with(jwt().authorities(role("RECEPTIONIST"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Staff member not found"));
    }

    @Test
    @DisplayName("Staff service slower than 2 s gives the fallback")
    void timeoutGivesFallback() throws Exception {
        long start = System.currentTimeMillis();
        mockMvc.perform(get("/api/patients/staff/" + SLOW).with(jwt().authorities(role("NURSE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.source").value("fallback"))
                .andExpect(jsonPath("$.fullName").doesNotExist());
        assertThat(System.currentTimeMillis() - start).isLessThan(2900);
    }

    @Test
    @DisplayName("Staff service 503 gives the fallback")
    void serverErrorGivesFallback() throws Exception {
        mockMvc.perform(get("/api/patients/staff/" + BROKEN).with(jwt().authorities(role("ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.source").value("fallback"));
    }

    @Test
    @DisplayName("Wrong role gives 403 and no Feign call")
    void wrongRoleIs403() throws Exception {
        mockMvc.perform(get("/api/patients/staff/" + FOUND).with(jwt().authorities(role("PHARMACIST"))))
                .andExpect(status().isForbidden());
        assertThat(lastAuthorization.get()).isNull();
    }

    @Test
    @DisplayName("No token gives 401")
    void noTokenIs401() throws Exception {
        mockMvc.perform(get("/api/patients/staff/" + FOUND))
                .andExpect(status().isUnauthorized());
    }
}
