package com.sgh.patient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgh.patient.config.DbReadyService;
import com.sgh.patient.model.Gender;
import com.sgh.patient.model.dto.CreateMedicalFileNoteRequest;
import com.sgh.patient.model.dto.PatientInputDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class PatientServiceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DbReadyService dbReadyService;

    private static final String P1_ID = "a1a1a1a1-0000-4000-8000-000000000001";
    private static final String P2_ID = "a1a1a1a1-0000-4000-8000-000000000002";

    @BeforeEach
    void setUp() {
        dbReadyService.setReady(true);
    }

    // -------------------------------------------------------------
    // Health & OpenAPI
    // -------------------------------------------------------------

    @Test
    @DisplayName("GET /health returns 200 UP without authentication")
    void healthCheckWithoutAuth() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("GET /openapi.json returns the OpenAPI spec")
    void openApiJsonReturnsSpec() throws Exception {
        mockMvc.perform(get("/openapi.json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists())
                .andExpect(jsonPath("$.info.title").value("SGH Patient service"));
    }

    // -------------------------------------------------------------
    // Stub Ping Acceptance Test
    // -------------------------------------------------------------

    @Test
    @DisplayName("GET /api/_stub/ping returns 401 without token")
    void stubPingUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/_stub/ping"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }

    @Test
    @DisplayName("GET /api/_stub/ping returns 403 for DOCTOR or NURSE")
    void stubPingForbiddenForNonAdmin() throws Exception {
        mockMvc.perform(get("/api/_stub/ping")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("GET /api/_stub/ping returns 200 for ADMIN")
    void stubPingSuccessForAdmin() throws Exception {
        mockMvc.perform(get("/api/_stub/ping")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("patient-service"));
    }

    // -------------------------------------------------------------
    // List & Search Patients (PAT-3, PAT-7)
    // -------------------------------------------------------------

    @Test
    @DisplayName("GET /api/patients lists seeded patients with pagination")
    void listPatientsSuccess() throws Exception {
        mockMvc.perform(get("/api/patients")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", not(empty())))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(8)));
    }

    @Test
    @DisplayName("GET /api/patients with search filter returns matching patients (PAT-3)")
    void searchPatientsCaseInsensitive() throws Exception {
        mockMvc.perform(get("/api/patients")
                        .param("search", "ben")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", not(empty())))
                .andExpect(jsonPath("$.content[0].lastName", containsStringIgnoringCase("Ben")));
    }

    // -------------------------------------------------------------
    // Create Patient (PAT-1, PAT-2, PAT-4)
    // -------------------------------------------------------------

    @Test
    @DisplayName("POST /api/patients by RECEPTIONIST registers patient and returns 201 + Location header (PAT-4)")
    void registerPatientSuccess() throws Exception {
        String uniqueName = "Test" + UUID.randomUUID().toString().substring(0, 5);
        PatientInputDto input = new PatientInputDto();
        input.setFirstName(uniqueName);
        input.setLastName("Alami");
        input.setBirthDate(LocalDate.of(1995, 6, 15));
        input.setGender(Gender.MALE);
        input.setPhone("+21620999888");
        input.setEmail(uniqueName.toLowerCase() + "@example.com");
        input.setBloodType("O+");

        mockMvc.perform(post("/api/patients")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/patients/")))
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.firstName").value(uniqueName))
                .andExpect(jsonPath("$.lastName").value("Alami"));
    }

    @Test
    @DisplayName("POST /api/patients returns 409 Conflict on duplicate patient (PAT-2)")
    void registerDuplicatePatientConflict() throws Exception {
        // Youssef Ben Salah 1985-03-14 is already seeded as P1
        PatientInputDto input = new PatientInputDto();
        input.setFirstName("youssef"); // case-insensitive check
        input.setLastName("BEN SALAH");
        input.setBirthDate(LocalDate.of(1985, 3, 14));
        input.setGender(Gender.MALE);

        mockMvc.perform(post("/api/patients")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message", containsString("already exists")));
    }

    @Test
    @DisplayName("POST /api/patients returns 422 Unprocessable on validation errors (PAT-1)")
    void registerPatientValidationErrors() throws Exception {
        PatientInputDto input = new PatientInputDto();
        // Missing firstName, lastName, gender
        input.setBirthDate(LocalDate.now().plusDays(10)); // Future date!

        mockMvc.perform(post("/api/patients")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.details", not(empty())));
    }

    @Test
    @DisplayName("POST /api/patients returns 403 for non-RECEPTIONIST role before body validation")
    void registerPatientRoleCheckBeforeValidation() throws Exception {
        // NURSE should be rejected with 403 immediately
        mockMvc.perform(post("/api/patients")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_NURSE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    // -------------------------------------------------------------
    // Get Patient & Ownership (PAT-5)
    // -------------------------------------------------------------

    @Test
    @DisplayName("GET /api/patients/{id} returns patient for clinical staff")
    void getPatientSuccessForStaff() throws Exception {
        mockMvc.perform(get("/api/patients/" + P1_ID)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(P1_ID))
                .andExpect(jsonPath("$.firstName").value("Youssef"))
                .andExpect(jsonPath("$.lastName").value("Ben Salah"));
    }

    @Test
    @DisplayName("GET /api/patients/{id} allows PATIENT role to access own record")
    void getPatientOwnRecordAllowed() throws Exception {
        mockMvc.perform(get("/api/patients/" + P1_ID)
                        .with(jwt()
                                .jwt(j -> j.claim("patientId", P1_ID))
                                .authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(P1_ID));
    }

    @Test
    @DisplayName("GET /api/patients/{id} returns 403 for PATIENT accessing another patient (PAT-5)")
    void getPatientOtherRecordForbidden() throws Exception {
        mockMvc.perform(get("/api/patients/" + P2_ID)
                        .with(jwt()
                                .jwt(j -> j.claim("patientId", P1_ID))
                                .authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("GET /api/patients/{id} returns 404 for non-existent patient")
    void getPatientNotFound() throws Exception {
        mockMvc.perform(get("/api/patients/" + UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    // -------------------------------------------------------------
    // Soft Delete (PAT-7)
    // -------------------------------------------------------------

    @Test
    @DisplayName("DELETE /api/patients/{id} by ADMIN performs soft delete and subsequent reads 404 (PAT-7)")
    void softDeletePatient() throws Exception {
        // First create a patient to delete
        String uniqueName = "ToDel" + UUID.randomUUID().toString().substring(0, 5);
        PatientInputDto input = new PatientInputDto();
        input.setFirstName(uniqueName);
        input.setLastName("DeleteMe");
        input.setBirthDate(LocalDate.of(1980, 1, 1));
        input.setGender(Gender.OTHER);

        String createRes = mockMvc.perform(post("/api/patients")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String createdId = objectMapper.readTree(createRes).get("id").asText();

        // Soft delete by ADMIN
        mockMvc.perform(delete("/api/patients/" + createdId)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isNoContent());

        // Subsequent GET should return 404
        mockMvc.perform(get("/api/patients/" + createdId)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST"))))
                .andExpect(status().isNotFound());
    }

    // -------------------------------------------------------------
    // Patient Summary (PAT-9)
    // -------------------------------------------------------------

    @Test
    @DisplayName("GET /api/patients/{id}/summary returns compact patient details")
    void getPatientSummary() throws Exception {
        mockMvc.perform(get("/api/patients/" + P1_ID + "/summary")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_PHARMACIST"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(P1_ID))
                .andExpect(jsonPath("$.fullName").value("Youssef Ben Salah"))
                .andExpect(jsonPath("$.birthDate").value("1985-03-14"));
    }

    // -------------------------------------------------------------
    // Medical File (PAT-6, PAT-8)
    // -------------------------------------------------------------

    @Test
    @DisplayName("POST /api/patients/{id}/medical-file by DOCTOR adds note entry (PAT-8)")
    void addMedicalFileNote() throws Exception {
        CreateMedicalFileNoteRequest req = new CreateMedicalFileNoteRequest("Patient reported mild headache.");

        mockMvc.perform(post("/api/patients/" + P1_ID + "/medical-file")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.patientId").value(P1_ID))
                .andExpect(jsonPath("$.type").value("NOTE"))
                .andExpect(jsonPath("$.sourceService").value("patient"))
                .andExpect(jsonPath("$.summary").value("Patient reported mild headache."));
    }

    @Test
    @DisplayName("GET /api/patients/{id}/medical-file returns entries for DOCTOR and NURSE")
    void listMedicalFileForStaff() throws Exception {
        mockMvc.perform(get("/api/patients/" + P1_ID + "/medical-file")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_NURSE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", not(empty())))
                .andExpect(jsonPath("$.page").value(0));
    }

    @Test
    @DisplayName("GET /api/patients/{id}/medical-file returns 403 for PATIENT on another patient's file (PAT-6)")
    void listMedicalFileForbiddenForOtherPatient() throws Exception {
        mockMvc.perform(get("/api/patients/" + P2_ID + "/medical-file")
                        .with(jwt()
                                .jwt(j -> j.claim("patientId", P1_ID))
                                .authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    // -------------------------------------------------------------
    // Rule X-8: Resilient Boot & Database Unavailable
    // -------------------------------------------------------------

    @Test
    @DisplayName("Rule X-8: When database is not ready, /health returns 200 UP but /api/ endpoints return 503")
    void databaseUnavailableBehavior() throws Exception {
        // Simulate DB not ready
        dbReadyService.setReady(false);

        // /health must remain 200 UP
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        // /api/ endpoint must return 503 Service Unavailable
        mockMvc.perform(get("/api/patients")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.error").value("Service Unavailable"))
                .andExpect(jsonPath("$.message").value("Database unavailable"));

        // Simulate DB recovering
        dbReadyService.setReady(true);

        mockMvc.perform(get("/api/patients")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST"))))
                .andExpect(status().isOk());
    }
}
