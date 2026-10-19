package com.sgh.gateway;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webtestclient.autoconfigure.AutoConfigureWebTestClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
abstract class GatewayTestBase {

    @Autowired
    WebTestClient client;

    @DynamicPropertySource
    static void stack(DynamicPropertyRegistry registry) {
        registry.add("PATIENT_SERVICE_URL", () -> TestStack.stub("patient").url());
        registry.add("RECEPTION_SERVICE_URL", () -> TestStack.stub("reception").url());
        registry.add("CONSULTATION_SERVICE_URL", () -> TestStack.stub("consultation").url());
        registry.add("LAB_SERVICE_URL", () -> TestStack.stub("lab").url());
        registry.add("PHARMACY_SERVICE_URL", () -> TestStack.stub("pharmacy").url());
        registry.add("STAFF_SERVICE_URL", () -> TestStack.stub("staff").url());
        registry.add("KEYCLOAK_JWKS_URL", TestStack::jwksUri);
    }

    @BeforeEach
    void resetStubs() {
        TestStack.resetStubs();
    }

    WebTestClient.RequestHeadersSpec<?> get(String path, String token) {
        WebTestClient.RequestHeadersSpec<?> spec = client.get().uri(path);
        return token == null ? spec : spec.header("Authorization", "Bearer " + token);
    }
}
