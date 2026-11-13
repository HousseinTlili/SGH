package com.sgh.patient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgh.patient.config.DbReadyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PatientAllergyIntegrationTest {

    static {
        TestDatabase.ensure();
    }

    private static final String P1 = "a1a1a1a1-0000-4000-8000-000000000001";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DbReadyService dbReadyService;

    @BeforeEach
    void ready() {
        dbReadyService.setReady(true);
    }

    @Test
    @DisplayName("V3 backfills legacy allergy without inventing clinical facts")
    void legacyAllergyIsBackfilled() throws Exception {
        mockMvc.perform(get("/api/patients/" + P1 + "/allergies")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.allergen=='Penicillin')]", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[?(@.allergen=='Penicillin')].verificationStatus", hasItem("DECLARED")))
                .andExpect(jsonPath("$[?(@.allergen=='Penicillin')].category", hasItem(nullValue())))
                .andExpect(jsonPath("$[?(@.allergen=='Penicillin')].reactionSeverity", hasItem(nullValue())));
    }

    @Test
    @DisplayName("Receptionist creates DECLARED allergy and cannot confirm it")
    void receptionistCreatesDeclaredButCannotVerify() throws Exception {
        String response = mockMvc.perform(post("/api/patients/" + P1 + "/allergies")
                        .header("X-Correlation-Id", "allergy1")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(input("Kiwi", 0)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/allergies/")))
                .andExpect(jsonPath("$.verificationStatus").value("DECLARED"))
                .andReturn().getResponse().getContentAsString();

        JsonNode created = objectMapper.readTree(response);
        mockMvc.perform(post("/api/patients/" + P1 + "/allergies/" + created.get("id").asText() + "/verification")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"verificationStatus":"CONFIRMED","version":%d}
                                """.formatted(created.get("version").asLong())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Doctor confirms allergy and immutable history records actor and correlation id")
    void doctorConfirmsAndHistoryIsAudited() throws Exception {
        String createdBody = mockMvc.perform(post("/api/patients/" + P1 + "/allergies")
                        .header("X-Correlation-Id", "create-a")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(input("Sesame", 0)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.verificationStatus").value("UNCONFIRMED"))
                .andReturn().getResponse().getContentAsString();
        JsonNode created = objectMapper.readTree(createdBody);
        String allergyId = created.get("id").asText();

        mockMvc.perform(post("/api/patients/" + P1 + "/allergies/" + allergyId + "/verification")
                        .header("X-Correlation-Id", "verify-a")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"verificationStatus":"CONFIRMED","version":%d}
                                """.formatted(created.get("version").asLong())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("CONFIRMED"));

        mockMvc.perform(get("/api/patients/" + P1 + "/allergies/" + allergyId + "/history")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_NURSE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].action").value("CONFIRM"))
                .andExpect(jsonPath("$[0].correlationId").value("verify-a"))
                .andExpect(jsonPath("$[0].changedByRole").value("DOCTOR"))
                .andExpect(jsonPath("$[1].action").value("CREATE"));
    }

    @Test
    @DisplayName("Stale allergy update returns 409")
    void staleVersionReturnsConflict() throws Exception {
        String response = mockMvc.perform(post("/api/patients/" + P1 + "/allergies")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(input("Nickel", 0)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String allergyId = objectMapper.readTree(response).get("id").asText();

        mockMvc.perform(put("/api/patients/" + P1 + "/allergies/" + allergyId)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(input("Nickel", 99)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Patient can read only own passport")
    void patientPassportOwnership() throws Exception {
        mockMvc.perform(get("/api/patients/" + P1 + "/allergy-passport")
                        .with(jwt()
                                .jwt(token -> token.claim("patientId", P1))
                                .authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.patientId").value(P1))
                .andExpect(jsonPath("$.allergies").isArray());

        mockMvc.perform(get("/api/patients/a1a1a1a1-0000-4000-8000-000000000002/allergy-passport")
                        .with(jwt()
                                .jwt(token -> token.claim("patientId", P1))
                                .authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Pharmacist cannot read passport and unauthenticated request is 401")
    void passportRoleSecurity() throws Exception {
        mockMvc.perform(get("/api/patients/" + P1 + "/allergy-passport")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_PHARMACIST"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/patients/" + P1 + "/allergy-passport"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Opaque passport token resolves the same passport without embedding clinical data in the token")
    void passportByOpaqueToken() throws Exception {
        String body = mockMvc.perform(get("/api/patients/" + P1 + "/allergy-passport")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passportToken").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String token = objectMapper.readTree(body).get("passportToken").asText();

        mockMvc.perform(get("/api/patients/passport/" + token)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_NURSE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.patientId").value(P1))
                .andExpect(jsonPath("$.passportToken").value(token));

        mockMvc.perform(get("/api/patients/passport/" + java.util.UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isNotFound());
    }

    private String input(String allergen, long version) {
        return """
                {
                  "allergen":"%s",
                  "category":"FOOD",
                  "observedReaction":"Urticaria reported by patient",
                  "reactionDate":"2026-01-10",
                  "reactionSeverity":"MODERATE",
                  "clinicalStatus":"ACTIVE",
                  "criticality":"UNABLE_TO_ASSESS",
                  "version":%d
                }
                """.formatted(allergen, version);
    }
}
