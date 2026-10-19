package com.sgh.gateway;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;

class GatewaySecurityTest extends GatewayTestBase {

    private static String b64(String json) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes());
    }

    @Test
    @DisplayName("No token on /api/patients -> 401 in the shared error body with a correlation id")
    void noToken() {
        get("/api/patients", null).exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.status").isEqualTo(401)
                .jsonPath("$.message").isEqualTo("Missing or invalid token")
                .jsonPath("$.path").isEqualTo("/api/patients")
                .jsonPath("$.correlationId").isNotEmpty();
    }

    @Test
    @DisplayName("Garbage, unsigned (alg none), wrong-key, expired and wrong-issuer tokens -> 401, without saying why")
    void invalidTokens() {
        String valid = TestStack.token("doctor1", "DOCTOR");
        String[] parts = valid.split("\\.");
        String unsigned = b64("{\"alg\":\"none\",\"typ\":\"JWT\"}") + "." + b64("{\"iss\":\"" + TestStack.ISSUER
                + "\",\"preferred_username\":\"x\",\"realm_access\":{\"roles\":[\"ADMIN\"]},\"exp\":4102444800}") + ".";
        String payloadEdited = parts[0] + "." + b64("{\"iss\":\"" + TestStack.ISSUER
                + "\",\"preferred_username\":\"x\",\"realm_access\":{\"roles\":[\"ADMIN\"]},\"exp\":4102444800}") + "." + parts[2];

        String[] bad = {
                "garbage",
                "a.b.c",
                unsigned,
                payloadEdited,
                TestStack.sign(TestStack.OTHER_KEY, TestStack.ISSUER, 3600, "doctor1", "DOCTOR"),
                TestStack.sign(TestStack.KEY, TestStack.ISSUER, -120, "doctor1", "DOCTOR"),
                TestStack.sign(TestStack.KEY, "http://evil.example/realms/sgh", 3600, "doctor1", "DOCTOR")
        };
        for (String token : bad) {
            get("/api/patients", token).exchange()
                    .expectStatus().isUnauthorized()
                    .expectBody().jsonPath("$.message").isEqualTo("Missing or invalid token");
        }
    }

    @Test
    @DisplayName("/health and /gateway/health/services need no token")
    void publicEndpoints() {
        get("/health", null).exchange().expectStatus().isOk().expectBody().jsonPath("$.status").isEqualTo("UP");
        get("/gateway/health/services", null).exchange().expectStatus().isOk();
    }

    @Test
    @DisplayName("Unknown roles in the token are ignored: a token with no SGH role gets 403")
    void unknownRoles() {
        get("/api/patients", TestStack.token("x", "SUPERUSER", "offline_access")).exchange()
                .expectStatus().isForbidden()
                .expectBody().jsonPath("$.message").isEqualTo("Your role is not allowed to do this");
    }

    @Test
    @DisplayName("The Authorization header reaches the service unchanged")
    void authorizationForwarded() {
        String token = TestStack.token("reception1", "RECEPTIONIST");
        get("/api/patients", token).exchange().expectStatus().isOk();
        org.assertj.core.api.Assertions.assertThat(TestStack.stub("patient").lastHeaders.get().get("authorization"))
                .isEqualTo("Bearer " + token);
    }
}
