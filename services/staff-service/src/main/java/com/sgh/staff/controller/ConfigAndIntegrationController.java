package com.sgh.staff.controller;

import com.sgh.staff.client.PatientServiceClient;
import com.sgh.staff.client.PatientSummaryDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/staff")
@RefreshScope
public class ConfigAndIntegrationController {

    private final PatientServiceClient patientServiceClient;

    @Value("${welcome.message:Welcome to SGH Staff Service}")
    private String welcomeMessage;

    public ConfigAndIntegrationController(PatientServiceClient patientServiceClient) {
        this.patientServiceClient = patientServiceClient;
    }

    /**
     * Demonstrates Spring Cloud Config Server & Actuator dynamic refresh.
     * Trigger POST /actuator/refresh to reload welcomeMessage live without restart.
     */
    @GetMapping("/config/welcome")
    public ResponseEntity<Map<String, String>> getWelcomeMessage() {
        return ResponseEntity.ok(Map.of(
                "service", "staff-service",
                "welcomeMessage", welcomeMessage
        ));
    }

    /**
     * Demonstrates OpenFeign synchronous inter-service communication:
     * Staff Service -> Patient Service (/api/patients/{id}/summary)
     */
    @GetMapping("/patient-summary/{patientId}")
    public ResponseEntity<PatientSummaryDto> getPatientSummary(@PathVariable UUID patientId) {
        try {
            PatientSummaryDto dto = patientServiceClient.getPatientSummary(patientId);
            return ResponseEntity.ok(dto);
        } catch (Exception ex) {
            return ResponseEntity.status(503).build();
        }
    }
}
