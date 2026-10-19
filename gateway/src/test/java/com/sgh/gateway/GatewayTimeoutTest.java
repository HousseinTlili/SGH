package com.sgh.gateway;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/** A service that accepts the connection and never answers is "down" too: 503 after the response timeout. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.cloud.gateway.server.webflux.httpclient.response-timeout=1s")
class GatewayTimeoutTest extends GatewayTestBase {

    @Test
    @DisplayName("A service that never answers -> 503 naming the service, after about the response timeout")
    void hangingServiceIs503() {
        TestStack.stub("pharmacy").hang = true;
        long started = System.currentTimeMillis();
        get("/api/drugs", TestStack.token("p", "PHARMACIST")).exchange()
                .expectStatus().isEqualTo(503)
                .expectBody()
                .jsonPath("$.service").isEqualTo("pharmacy")
                .jsonPath("$.correlationId").isNotEmpty();
        assertThat(System.currentTimeMillis() - started).isBetween(900L, 5000L);

        // the other services are not affected
        get("/api/patients", TestStack.token("r", "RECEPTIONIST")).exchange().expectStatus().isOk();
    }
}
