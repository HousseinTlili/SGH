package com.sgh.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webtestclient.autoconfigure.AutoConfigureWebTestClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.net.ServerSocket;

/** Every service and Keycloak unreachable from the first second: the gateway still starts and answers. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.cloud.gateway.server.webflux.httpclient.response-timeout=1s",
                "spring.cloud.gateway.server.webflux.httpclient.connect-timeout=500"
        })
@AutoConfigureWebTestClient
class GatewayResilienceTest {

    @Autowired
    WebTestClient client;

    private static int closedPort() {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort(); // free right now, and nothing listens on it
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void everythingDown(DynamicPropertyRegistry registry) {
        for (String env : new String[]{"PATIENT", "RECEPTION", "CONSULTATION", "LAB", "PHARMACY"}) {
            int port = closedPort();
            registry.add(env + "_SERVICE_URL", () -> "http://127.0.0.1:" + port);
        }
        int staff = closedPort();
        registry.add("STAFF_SERVICE_URL", () -> "http://127.0.0.1:" + staff);
        int keycloak = closedPort();
        registry.add("KEYCLOAK_JWKS_URL", () -> "http://127.0.0.1:" + keycloak + "/certs");
    }

    @Test
    void startsWithEveryServiceAndKeycloakStopped() {
        client.get().uri("/health").exchange().expectStatus().isOk().expectBody().jsonPath("$.status").isEqualTo("UP");

        client.get().uri("/gateway/health/services").exchange().expectStatus().isOk()
                .expectBody()
                .jsonPath("$.gateway").isEqualTo("UP")
                .jsonPath("$.services.patient").isEqualTo("DOWN")
                .jsonPath("$.services.lab").isEqualTo("DOWN")
                .jsonPath("$.services.staff").isEqualTo("DOWN");

        // Keycloak's keys cannot be fetched: the token cannot be verified, so it is refused (401), not a 500
        client.get().uri("/api/patients").header("Authorization", "Bearer " + TestStack.token("a", "ADMIN")).exchange()
                .expectStatus().isUnauthorized();
    }
}
