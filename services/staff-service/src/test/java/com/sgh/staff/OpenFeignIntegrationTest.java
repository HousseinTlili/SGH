package com.sgh.staff;

import com.sgh.staff.client.PatientServiceClient;
import com.sgh.staff.client.PatientSummaryDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class OpenFeignIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PatientServiceClient patientServiceClient;

    @Test
    @DisplayName("Dynamic Config: GET /api/staff/config/welcome returns welcome message")
    void testDynamicConfigEndpoint() throws Exception {
        mockMvc.perform(get("/api/staff/config/welcome"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("staff-service"))
                .andExpect(jsonPath("$.welcomeMessage").exists());
    }

    @Test
    @DisplayName("OpenFeign synchronous call: GET /api/staff/patient-summary/{id} invokes PatientServiceClient")
    void testOpenFeignPatientLookup() throws Exception {
        UUID patientId = UUID.fromString("a1a1a1a1-0000-4000-8000-000000000001");
        given(patientServiceClient.getPatientSummary(patientId))
                .willReturn(new PatientSummaryDto(patientId, "Youssef", "Ben Salah", "1985-04-12", "08123456", "+21698123456"));

        mockMvc.perform(get("/api/staff/patient-summary/" + patientId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(patientId.toString()))
                .andExpect(jsonPath("$.firstName").value("Youssef"))
                .andExpect(jsonPath("$.lastName").value("Ben Salah"));
    }
}
