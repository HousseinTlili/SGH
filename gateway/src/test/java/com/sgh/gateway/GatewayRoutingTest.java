package com.sgh.gateway;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayRoutingTest extends GatewayTestBase {

    private static final List<String> ALL = List.of("PATIENT", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "RECEPTIONIST", "ADMIN");

    /** The route table of Gateway Config: path -> service stub that must answer, and the roles that may enter. */
    record Rule(String path, String service, List<String> roles) {
    }

    static final List<Rule> RULES = List.of(
            new Rule("/api/patients", "patient", ALL),
            new Rule("/api/patients/a1a1a1a1-0000-4000-8000-000000000001/summary", "patient", ALL),
            new Rule("/api/appointments", "reception", List.of("RECEPTIONIST", "DOCTOR", "ADMIN", "PATIENT")),
            new Rule("/api/appointments/availability", "reception", List.of("RECEPTIONIST", "DOCTOR", "ADMIN", "PATIENT")),
            new Rule("/api/invoices", "reception", List.of("RECEPTIONIST", "ADMIN", "PATIENT")),
            new Rule("/api/consultations", "consultation", List.of("DOCTOR", "NURSE", "ADMIN", "PATIENT", "PHARMACIST")),
            new Rule("/api/consultations/x/prescriptions", "consultation", List.of("DOCTOR", "NURSE", "ADMIN", "PATIENT", "PHARMACIST")),
            new Rule("/api/vitals", "consultation", List.of("DOCTOR", "NURSE", "ADMIN")),
            new Rule("/api/lab-requests", "lab", List.of("LAB_TECHNICIAN", "DOCTOR", "ADMIN")),
            new Rule("/api/lab-results", "lab", List.of("LAB_TECHNICIAN", "DOCTOR", "ADMIN")),
            new Rule("/api/tests", "lab", List.of("LAB_TECHNICIAN", "DOCTOR", "ADMIN")),
            new Rule("/api/drugs", "pharmacy", List.of("PHARMACIST", "DOCTOR", "ADMIN")),
            new Rule("/api/stock/alerts", "pharmacy", List.of("PHARMACIST", "DOCTOR", "ADMIN")),
            new Rule("/api/prescriptions", "pharmacy", List.of("PHARMACIST", "DOCTOR", "ADMIN")),
            new Rule("/api/staff", "staff", ALL),
            new Rule("/api/staff/directory", "staff", ALL),
            new Rule("/api/roles", "staff", ALL),
            new Rule("/api/me", "staff", ALL));

    static Stream<Arguments> everyRuleAndRole() {
        return RULES.stream().flatMap(rule -> ALL.stream().map(role -> Arguments.of(rule, role)));
    }

    @ParameterizedTest(name = "{0} as {1}")
    @MethodSource("everyRuleAndRole")
    @DisplayName("Every prefix reaches the right service for allowed roles and is refused (403) for the others")
    void roleRulesAndRouting(Rule rule, String role) {
        var response = get(rule.path(), TestStack.token("user", role)).exchange();
        if (rule.roles().contains(role)) {
            response.expectStatus().isOk().expectBody().jsonPath("$.service").isEqualTo(rule.service());
            assertThat(TestStack.stub(rule.service()).lastPath.get()).isEqualTo(rule.path()); // path forwarded unchanged
        } else {
            response.expectStatus().isForbidden();
            // refused at the edge: the service never saw the request
            assertThat(TestStack.stub(rule.service()).lastPath.get()).isNull();
        }
    }

    @Test
    @DisplayName("NURSE on /api/drugs -> 403 from the gateway; PHARMACIST reaches the service")
    void drugsRule() {
        get("/api/drugs", TestStack.token("nurse1", "NURSE")).exchange().expectStatus().isForbidden();
        get("/api/drugs", TestStack.token("pharmacist1", "PHARMACIST")).exchange().expectStatus().isOk();
    }

    @Test
    @DisplayName("The gateway does not look at HTTP methods: a POST by an allowed role is forwarded")
    void methodsAreNotChecked() {
        client.post().uri("/api/patients").header("Authorization", "Bearer " + TestStack.token("r", "RECEPTIONIST"))
                .bodyValue("{}").exchange().expectStatus().isOk();
        assertThat(TestStack.stub("patient").lastPath.get()).isEqualTo("/api/patients");
    }

    @Test
    @DisplayName("An authenticated request outside the route table -> 404 in the shared error body")
    void unknownRoute() {
        get("/api/nothing", TestStack.token("a", "ADMIN")).exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.status").isEqualTo(404).jsonPath("$.correlationId").isNotEmpty();
    }

    @Test
    @DisplayName("A service that answers 409 or 422 is passed through unchanged")
    void errorsPassThrough() {
        String token = TestStack.token("reception1", "RECEPTIONIST");
        for (int status : new int[]{409, 422, 404, 500}) {
            TestStack.stub("patient").forcedStatus.set(status);
            get("/api/patients", token).exchange()
                    .expectStatus().isEqualTo(status)
                    .expectBody().jsonPath("$.from").isEqualTo("patient").jsonPath("$.message").isEqualTo("as the service said");
        }
    }

    @Test
    @DisplayName("A stopped service -> 503 naming the service with a correlation id; the others keep answering")
    void stoppedServiceIs503() {
        TestStack.stub("lab").stop();
        get("/api/lab-requests", TestStack.token("lab1", "LAB_TECHNICIAN")).header("X-Correlation-Id", "cid-lab-1").exchange()
                .expectStatus().isEqualTo(503)
                .expectHeader().valueEquals("X-Correlation-Id", "cid-lab-1")
                .expectBody()
                .jsonPath("$.status").isEqualTo(503)
                .jsonPath("$.error").isEqualTo("Service Unavailable")
                .jsonPath("$.service").isEqualTo("lab")
                .jsonPath("$.message").isEqualTo("Lab service is unavailable, please try again later")
                .jsonPath("$.correlationId").isEqualTo("cid-lab-1");

        get("/api/patients", TestStack.token("r", "RECEPTIONIST")).exchange().expectStatus().isOk();
        get("/api/drugs", TestStack.token("p", "PHARMACIST")).exchange().expectStatus().isOk();
    }

    @Test
    @DisplayName("Every service reports its own name in the 503 body")
    void everyServiceNamesItself() {
        record Case(String service, String path, String role) {
        }
        for (Case c : List.of(
                new Case("patient", "/api/patients", "ADMIN"),
                new Case("reception", "/api/appointments", "ADMIN"),
                new Case("consultation", "/api/consultations", "ADMIN"),
                new Case("lab", "/api/tests", "ADMIN"),
                new Case("pharmacy", "/api/drugs", "ADMIN"),
                new Case("staff", "/api/staff", "ADMIN"))) {
            TestStack.stub(c.service()).stop();
            get(c.path(), TestStack.token("a", c.role())).exchange()
                    .expectStatus().isEqualTo(503)
                    .expectBody().jsonPath("$.service").isEqualTo(c.service());
        }
    }

    @Test
    @DisplayName("X-Correlation-Id is created when missing, echoed when sent and forwarded to the service")
    void correlationId() {
        String token = TestStack.token("r", "RECEPTIONIST");
        var created = get("/api/patients", token).exchange().expectStatus().isOk().returnResult(String.class);
        String id = created.getResponseHeaders().getFirst("X-Correlation-Id");
        assertThat(id).hasSize(8);
        assertThat(TestStack.stub("patient").lastHeaders.get().get("x-correlation-id")).isEqualTo(id);

        get("/api/patients", token).header("X-Correlation-Id", "abc-12345").exchange()
                .expectHeader().valueEquals("X-Correlation-Id", "abc-12345");
        assertThat(TestStack.stub("patient").lastHeaders.get().get("x-correlation-id")).isEqualTo("abc-12345");
    }

    @Test
    @DisplayName("CORS: a preflight from http://localhost:4200 succeeds, from another origin it gets no CORS headers")
    void cors() {
        client.options().uri("/api/patients")
                .header("Origin", "http://localhost:4200")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "authorization,content-type,x-correlation-id")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals("Access-Control-Allow-Origin", "http://localhost:4200")
                .expectHeader().value("Access-Control-Allow-Methods", v -> assertThat(v).contains("POST", "PUT", "DELETE"));

        var other = client.options().uri("/api/patients")
                .header("Origin", "http://evil.example")
                .header("Access-Control-Request-Method", "POST")
                .exchange().returnResult(String.class);
        assertThat(other.getResponseHeaders().getFirst("Access-Control-Allow-Origin")).isNull();

        client.get().uri("/api/patients")
                .header("Origin", "http://localhost:4200")
                .header("Authorization", "Bearer " + TestStack.token("r", "RECEPTIONIST"))
                .exchange()
                .expectHeader().value("Access-Control-Expose-Headers", v -> assertThat(v).contains("X-Correlation-Id", "Location"));
        // the services add none of their own: the stub sends no CORS headers and the gateway adds exactly one set
    }

    @Test
    @DisplayName("/gateway/health/services reports DOWN for a stopped service within 3 seconds, and recovers")
    void statusEndpoint() throws InterruptedException {
        get("/gateway/health/services", null).exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.gateway").isEqualTo("UP")
                .jsonPath("$.services.lab").isEqualTo("UP")
                .jsonPath("$.services.patient").isEqualTo("UP")
                .jsonPath("$.checkedAt").isNotEmpty();

        TestStack.stub("lab").stop();
        long deadline = System.currentTimeMillis() + 3000;
        boolean down = false;
        while (System.currentTimeMillis() < deadline && !down) {
            String body = get("/gateway/health/services", null).exchange().returnResult(String.class).getResponseBody().blockFirst();
            down = body != null && body.contains("\"lab\":\"DOWN\"");
            if (!down) Thread.sleep(200);
        }
        assertThat(down).as("lab shows DOWN within 3 seconds").isTrue();

        TestStack.stub("lab").start();
        long recovery = System.currentTimeMillis() + 3500;
        boolean up = false;
        while (System.currentTimeMillis() < recovery && !up) {
            String body = get("/gateway/health/services", null).exchange().returnResult(String.class).getResponseBody().blockFirst();
            up = body != null && body.contains("\"lab\":\"UP\"");
            if (!up) Thread.sleep(200);
        }
        assertThat(up).as("lab shows UP again").isTrue();
    }
}
