package com.sgh.patient.controller;

import com.sgh.patient.client.StaffPublicDto;
import com.sgh.patient.client.StaffServiceClient;
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
@RequestMapping("/api/patients")
@RefreshScope
public class ConfigAndIntegrationController {

    private final StaffServiceClient staffServiceClient;

    @Value("${welcome.message:Welcome to SGH Patient Service}")
    private String welcomeMessage;

    public ConfigAndIntegrationController(StaffServiceClient staffServiceClient) {
        this.staffServiceClient = staffServiceClient;
    }

    /**
     * Demonstrates Spring Cloud Config Server & Actuator dynamic refresh.
     * Trigger POST /actuator/refresh to reload welcomeMessage live without restart.
     */
    @GetMapping("/config/welcome")
    public ResponseEntity<Map<String, String>> getWelcomeMessage() {
        return ResponseEntity.ok(Map.of(
                "service", "patient-service",
                "welcomeMessage", welcomeMessage
        ));
    }

    /**
     * Demonstrates OpenFeign synchronous inter-service communication:
     * Patient Service -> Staff Service (/api/staff/{id}/public)
     */
    @GetMapping("/practitioner/{staffId}")
    public ResponseEntity<StaffPublicDto> getPractitionerInfo(@PathVariable UUID staffId) {
        try {
            StaffPublicDto dto = staffServiceClient.getStaffPublic(staffId);
            return ResponseEntity.ok(dto);
        } catch (Exception ex) {
            return ResponseEntity.status(503).build();
        }
    }
}
