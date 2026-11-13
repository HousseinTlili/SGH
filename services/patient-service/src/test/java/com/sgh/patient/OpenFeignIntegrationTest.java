package com.sgh.patient;

import com.sgh.patient.client.StaffPublicDto;
import com.sgh.patient.client.StaffServiceClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenFeignIntegrationTest {

    static {
        TestDatabase.ensure();
    }

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StaffServiceClient staffServiceClient;

    @Test
    @DisplayName("Dynamic Config: GET /api/patients/config/welcome returns welcome message")
    void testDynamicConfigEndpoint() throws Exception {
        mockMvc.perform(get("/api/patients/config/welcome"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("patient-service"))
                .andExpect(jsonPath("$.welcomeMessage").exists());
    }

    @Test
    @DisplayName("OpenFeign synchronous call: GET /api/patients/practitioner/{id} invokes StaffServiceClient")
    void testOpenFeignStaffLookup() throws Exception {
        UUID doctorId = UUID.fromString("b2b2b2b2-0000-4000-8000-000000000001");
        given(staffServiceClient.getStaffPublic(doctorId))
                .willReturn(new StaffPublicDto(doctorId, "Dr. Amel Trabelsi", "DOCTOR", "Cardiology", "DOC-TN-78901"));

        mockMvc.perform(get("/api/patients/practitioner/" + doctorId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(doctorId.toString()))
                .andExpect(jsonPath("$.name").value("Dr. Amel Trabelsi"))
                .andExpect(jsonPath("$.role").value("DOCTOR"))
                .andExpect(jsonPath("$.department").value("Cardiology"));
    }
}
