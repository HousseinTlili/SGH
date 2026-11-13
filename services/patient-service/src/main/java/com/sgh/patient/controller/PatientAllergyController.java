package com.sgh.patient.controller;

import com.sgh.patient.model.dto.*;
import com.sgh.patient.service.PatientAllergyService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients/{patientId}")
public class PatientAllergyController {

    private final PatientAllergyService allergyService;

    public PatientAllergyController(PatientAllergyService allergyService) {
        this.allergyService = allergyService;
    }

    @GetMapping("/allergies")
    public ResponseEntity<List<PatientAllergyResponseDto>> list(
            @PathVariable UUID patientId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(allergyService.list(patientId, authentication));
    }

    @GetMapping("/allergies/{allergyId}")
    public ResponseEntity<PatientAllergyResponseDto> get(
            @PathVariable UUID patientId,
            @PathVariable UUID allergyId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(allergyService.get(patientId, allergyId, authentication));
    }

    @PostMapping("/allergies")
    public ResponseEntity<PatientAllergyResponseDto> create(
            @PathVariable UUID patientId,
            @Valid @RequestBody PatientAllergyInputDto input,
            Authentication authentication,
            HttpServletRequest request
    ) {
        PatientAllergyResponseDto created = allergyService.create(
                patientId,
                input,
                authentication,
                correlationId(request)
        );
        return ResponseEntity
                .created(URI.create("/api/patients/" + patientId + "/allergies/" + created.id()))
                .body(created);
    }

    @PutMapping("/allergies/{allergyId}")
    public ResponseEntity<PatientAllergyResponseDto> update(
            @PathVariable UUID patientId,
            @PathVariable UUID allergyId,
            @Valid @RequestBody PatientAllergyInputDto input,
            Authentication authentication,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(allergyService.update(
                patientId,
                allergyId,
                input,
                authentication,
                correlationId(request)
        ));
    }

    @PostMapping("/allergies/{allergyId}/verification")
    public ResponseEntity<PatientAllergyResponseDto> verify(
            @PathVariable UUID patientId,
            @PathVariable UUID allergyId,
            @Valid @RequestBody AllergyVerificationRequest input,
            Authentication authentication,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(allergyService.verify(
                patientId,
                allergyId,
                input,
                authentication,
                correlationId(request)
        ));
    }

    @GetMapping("/allergies/{allergyId}/history")
    public ResponseEntity<List<AllergyHistoryDto>> history(
            @PathVariable UUID patientId,
            @PathVariable UUID allergyId
    ) {
        return ResponseEntity.ok(allergyService.history(patientId, allergyId));
    }

    @GetMapping("/allergy-passport")
    public ResponseEntity<AllergyPassportDto> passport(
            @PathVariable UUID patientId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(allergyService.passport(patientId, authentication));
    }

    private String correlationId(HttpServletRequest request) {
        Object id = request.getAttribute("correlationId");
        return id == null ? request.getHeader("X-Correlation-Id") : id.toString();
    }
}
