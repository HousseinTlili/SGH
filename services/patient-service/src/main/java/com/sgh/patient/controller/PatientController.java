package com.sgh.patient.controller;

import com.sgh.patient.model.dto.PagedResponse;
import com.sgh.patient.model.dto.PatientInputDto;
import com.sgh.patient.model.dto.PatientResponseDto;
import com.sgh.patient.model.dto.PatientSummaryDto;
import com.sgh.patient.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<PatientResponseDto>> listPatients(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(patientService.listPatients(search, page, size));
    }

    @PostMapping
    public ResponseEntity<PatientResponseDto> createPatient(@Valid @RequestBody PatientInputDto input) {
        PatientResponseDto created = patientService.createPatient(input);
        URI location = URI.create("/api/patients/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PatientResponseDto> getPatient(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(patientService.getPatient(id, authentication));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PatientResponseDto> updatePatient(
            @PathVariable UUID id,
            @Valid @RequestBody PatientInputDto input
    ) {
        return ResponseEntity.ok(patientService.updatePatient(id, input));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePatient(@PathVariable UUID id) {
        patientService.deletePatient(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<PatientSummaryDto> getPatientSummary(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(patientService.getPatientSummary(id, authentication));
    }
}
