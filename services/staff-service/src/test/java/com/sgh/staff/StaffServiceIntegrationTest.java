package com.sgh.staff;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgh.staff.config.DbReadyService;
import com.sgh.staff.model.StaffMember;
import com.sgh.staff.model.StaffRole;
import com.sgh.staff.model.dto.StaffInputDto;
import com.sgh.staff.repository.StaffRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class StaffServiceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StaffRepository staffRepository;

    @Autowired
    private DbReadyService dbReadyService;

    @Autowired
    private ObjectMapper objectMapper;

    private UUID doctor1Id;
    private UUID doctor2Id;
    private UUID nurse1Id;
    private UUID admin1Id;

    @BeforeEach
    void setup() {
        dbReadyService.setReady(true);
        staffRepository.deleteAll();

        // Seed sample staff members corresponding to SGH seed
        doctor1Id = UUID.fromString("b2b2b2b2-0000-4000-8000-000000000001");
        doctor2Id = UUID.fromString("b2b2b2b2-0000-4000-8000-000000000002");
        nurse1Id = UUID.fromString("b2b2b2b2-0000-4000-8000-000000000003");
        admin1Id = UUID.fromString("b2b2b2b2-0000-4000-8000-000000000007");

        StaffMember s1 = new StaffMember(
                doctor1Id,
                UUID.fromString("c3c3c3c3-0000-4000-8000-000000000001"),
                "Amel",
                "Trabelsi",
                StaffRole.DOCTOR,
                "Cardiology",
                "Cardiology",
                "doctor1@sgh.local",
                true,
                Instant.parse("2026-10-12T08:00:00Z"),
                Instant.parse("2026-10-12T08:00:00Z")
        );

        StaffMember s2 = new StaffMember(
                doctor2Id,
                UUID.fromString("c3c3c3c3-0000-4000-8000-000000000002"),
                "Karim",
                "Jlassi",
                StaffRole.DOCTOR,
                "General practice",
                "General Medicine",
                "doctor2@sgh.local",
                true,
                Instant.parse("2026-10-12T08:00:00Z"),
                Instant.parse("2026-10-12T08:00:00Z")
        );

        StaffMember s3 = new StaffMember(
                nurse1Id,
                UUID.fromString("c3c3c3c3-0000-4000-8000-000000000003"),
                "Sonia",
                "Gharbi",
                StaffRole.NURSE,
                null,
                "Nursing",
                "nurse1@sgh.local",
                true,
                Instant.parse("2026-10-12T08:00:00Z"),
                Instant.parse("2026-10-12T08:00:00Z")
        );

        StaffMember s7 = new StaffMember(
                admin1Id,
                UUID.fromString("c3c3c3c3-0000-4000-8000-000000000007"),
                "Sami",
                "Hamdi",
                StaffRole.ADMIN,
                null,
                "IT",
                "admin1@sgh.local",
                true,
                Instant.parse("2026-10-12T08:00:00Z"),
                Instant.parse("2026-10-12T08:00:00Z")
        );

        staffRepository.saveAll(List.of(s1, s2, s3, s7));
    }

    // --- Group 1: Health and Documentation ---

    @Test
    @DisplayName("Health endpoint returns 200 UP without auth (X-6)")
    void testHealthEndpoint() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("OpenAPI JSON endpoint returns 200 without auth")
    void testOpenApiJsonEndpoint() throws Exception {
        mockMvc.perform(get("/openapi.json"))
                .andExpect(status().isOk());
    }

    // --- Group 2: Error mapping (Stack Templates) ---

    @Test
    @DisplayName("Unknown route answers 404 in the shared error body")
    void testUnknownRoute() throws Exception {
        mockMvc.perform(get("/api/nothing-here")
                        .header("X-Correlation-Id", "abc12345")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.correlationId").value("abc12345"));
    }

    @Test
    @DisplayName("Malformed JSON answers 400")
    void testMalformedJson() throws Exception {
        mockMvc.perform(post("/api/staff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ not json")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"));
    }

    @Test
    @DisplayName("A path id that is not a UUID answers 400")
    void testBadUuid() throws Exception {
        mockMvc.perform(get("/api/staff/not-a-uuid")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isBadRequest());
    }

    // --- Group 3: Staff Listing and Search (ADMIN) ---

    @Test
    @DisplayName("List staff returns paged items sorted by lastName ASC (ADMIN)")
    void testListStaffSuccess() throws Exception {
        mockMvc.perform(get("/api/staff")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.content[0].lastName").value("Gharbi"))
                .andExpect(jsonPath("$.content[1].lastName").value("Hamdi"))
                .andExpect(jsonPath("$.content[2].lastName").value("Jlassi"))
                .andExpect(jsonPath("$.content[3].lastName").value("Trabelsi"));
    }

    @Test
    @DisplayName("List staff filters by role")
    void testListStaffFilterByRole() throws Exception {
        mockMvc.perform(get("/api/staff?role=DOCTOR")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].role", everyItem(is("DOCTOR"))));
    }

    @Test
    @DisplayName("List staff filters by search substring")
    void testListStaffSearch() throws Exception {
        mockMvc.perform(get("/api/staff?search=amel")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].firstName").value("Amel"));
    }

    @Test
    @DisplayName("List staff returns 403 for RECEPTIONIST")
    void testListStaffForbiddenForReceptionist() throws Exception {
        mockMvc.perform(get("/api/staff")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST"))))
                .andExpect(status().isForbidden());
    }

    // --- Group 4: Staff Creation (STF-1, STF-2) ---

    @Test
    @DisplayName("Create staff returns 201 with Location header (STF-1, STF-2)")
    void testCreateStaffSuccess() throws Exception {
        StaffInputDto input = new StaffInputDto(
                "Rim",
                "Bouazizi",
                StaffRole.RECEPTIONIST,
                null,
                "Front Desk",
                "reception1@sgh.local",
                UUID.fromString("c3c3c3c3-0000-4000-8000-000000000006")
        );

        mockMvc.perform(post("/api/staff")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/staff/")))
                .andExpect(jsonPath("$.firstName").value("Rim"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    @DisplayName("Create staff with duplicate email returns 409 Conflict")
    void testCreateStaffDuplicateEmail() throws Exception {
        StaffInputDto input = new StaffInputDto(
                "Duplicate",
                "Doctor",
                StaffRole.DOCTOR,
                null,
                "Cardiology",
                "doctor1@sgh.local", // already exists
                null
        );

        mockMvc.perform(post("/api/staff")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("This e-mail is already used"));
    }

    @Test
    @DisplayName("Create staff with validation errors returns 422 Unprocessable")
    void testCreateStaffValidationError() throws Exception {
        StaffInputDto input = new StaffInputDto(
                "",
                "Doctor",
                null,
                null,
                "Cardiology",
                "invalid-email",
                null
        );

        mockMvc.perform(post("/api/staff")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.details").isArray());
    }

    // --- Group 5: Staff Get and Update ---

    @Test
    @DisplayName("Get staff by ID returns 200 (ADMIN)")
    void testGetStaffByIdSuccess() throws Exception {
        mockMvc.perform(get("/api/staff/" + doctor1Id)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(doctor1Id.toString()))
                .andExpect(jsonPath("$.firstName").value("Amel"));
    }

    @Test
    @DisplayName("Get staff by unknown ID returns 404")
    void testGetStaffByIdNotFound() throws Exception {
        mockMvc.perform(get("/api/staff/" + UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Update staff replaces profile (ADMIN)")
    void testUpdateStaffSuccess() throws Exception {
        StaffInputDto update = new StaffInputDto(
                "Amel",
                "Trabelsi-Smith",
                StaffRole.DOCTOR,
                "Interventional Cardiology",
                "Cardiology",
                "doctor1@sgh.local",
                null
        );

        mockMvc.perform(put("/api/staff/" + doctor1Id)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastName").value("Trabelsi-Smith"))
                .andExpect(jsonPath("$.specialty").value("Interventional Cardiology"));
    }

    @Test
    @DisplayName("Update staff with duplicate email on another member returns 409")
    void testUpdateStaffDuplicateEmail() throws Exception {
        StaffInputDto update = new StaffInputDto(
                "Karim",
                "Jlassi",
                StaffRole.DOCTOR,
                "General practice",
                "General Medicine",
                "doctor1@sgh.local", // email belongs to doctor1
                null
        );

        mockMvc.perform(put("/api/staff/" + doctor2Id)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isConflict());
    }

    // --- Group 6: Deactivation ---

    @Test
    @DisplayName("Deactivate staff member sets active=false (ADMIN)")
    void testDeactivateStaffSuccess() throws Exception {
        mockMvc.perform(post("/api/staff/" + doctor1Id + "/deactivate")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        // Attempting to deactivate again returns 409
        mockMvc.perform(post("/api/staff/" + doctor1Id + "/deactivate")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Staff member is already inactive"));
    }

    // --- Group 7: Directory & Public Staff (STF-4, Route Order) ---

    @Test
    @DisplayName("Route order: /api/staff/directory is matched before /{id} and returns active staff (STF-4)")
    void testDirectoryEndpoint() throws Exception {
        mockMvc.perform(get("/api/staff/directory")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].fullName").value("Amel Trabelsi"))
                .andExpect(jsonPath("$[1].fullName").value("Karim Jlassi"));
    }

    @Test
    @DisplayName("Directory with role=DOCTOR returns 2 active doctors")
    void testDirectoryFilterByRole() throws Exception {
        mockMvc.perform(get("/api/staff/directory?role=DOCTOR")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].role").value("DOCTOR"))
                .andExpect(jsonPath("$[1].role").value("DOCTOR"));
    }

    @Test
    @DisplayName("Directory returns 403 for PATIENT")
    void testDirectoryForbiddenForPatient() throws Exception {
        mockMvc.perform(get("/api/staff/directory")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Public staff endpoint returns minimal profile for active staff to any user")
    void testPublicStaffSuccess() throws Exception {
        mockMvc.perform(get("/api/staff/" + doctor1Id + "/public")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(doctor1Id.toString()))
                .andExpect(jsonPath("$.fullName").value("Amel Trabelsi"))
                .andExpect(jsonPath("$.role").value("DOCTOR"))
                .andExpect(jsonPath("$.specialty").value("Cardiology"));
    }

    @Test
    @DisplayName("Public staff endpoint returns 404 for deactivated staff")
    void testPublicStaffDeactivatedNotFound() throws Exception {
        // Deactivate doctor1
        mockMvc.perform(post("/api/staff/" + doctor1Id + "/deactivate")
                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))));

        // Now public view returns 404
        mockMvc.perform(get("/api/staff/" + doctor1Id + "/public")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isNotFound());
    }

    // --- Group 8: Roles & Me Profile (STF-5) ---

    @Test
    @DisplayName("Roles endpoint returns the 7 role names")
    void testRolesEndpoint() throws Exception {
        mockMvc.perform(get("/api/roles")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(7))
                .andExpect(jsonPath("$", containsInAnyOrder(
                        "PATIENT", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "RECEPTIONIST", "ADMIN"
                )));
    }

    @Test
    @DisplayName("Me endpoint returns staff profile when staffId claim is present (STF-5)")
    void testMeEndpointForStaff() throws Exception {
        mockMvc.perform(get("/api/me")
                        .with(jwt()
                                .jwt(j -> j.claim("preferred_username", "doctor1")
                                        .claim("staffId", doctor1Id.toString())
                                        .claim("realm_access", Map.of("roles", List.of("DOCTOR", "offline_access", "default-roles-sgh"))))
                                .authorities(new SimpleGrantedAuthority("ROLE_DOCTOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("doctor1"))
                .andExpect(jsonPath("$.roles").value(hasItem("DOCTOR")))
                .andExpect(jsonPath("$.roles").value(not(hasItem("offline_access"))))
                .andExpect(jsonPath("$.staff.id").value(doctor1Id.toString()))
                .andExpect(jsonPath("$.staff.fullName").value("Amel Trabelsi"))
                .andExpect(jsonPath("$.staff.role").value("DOCTOR"))
                .andExpect(jsonPath("$.patientId").value(nullValue()));
    }

    @Test
    @DisplayName("Me endpoint returns patientId and staff null when patientId claim is present (STF-5)")
    void testMeEndpointForPatient() throws Exception {
        UUID patientId = UUID.fromString("a1a1a1a1-0000-4000-8000-000000000001");

        mockMvc.perform(get("/api/me")
                        .with(jwt()
                                .jwt(j -> j.claim("preferred_username", "patient1")
                                        .claim("patientId", patientId.toString())
                                        .claim("realm_access", Map.of("roles", List.of("PATIENT"))))
                                .authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("patient1"))
                .andExpect(jsonPath("$.roles").value(hasItem("PATIENT")))
                .andExpect(jsonPath("$.staff").value(nullValue()))
                .andExpect(jsonPath("$.patientId").value(patientId.toString()));
    }

    // --- Group 9: Resilience (X-8) ---

    @Test
    @DisplayName("Returns 503 Database Unavailable when DbReadyService is not ready (X-8)")
    void testDatabaseUnavailableWhenNotReady() throws Exception {
        dbReadyService.setReady(false);

        mockMvc.perform(get("/api/staff/directory")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECEPTIONIST"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.message").value("Database unavailable"));

        // Liveness health endpoint must still return 200 UP
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        dbReadyService.setReady(true);
    }
}
