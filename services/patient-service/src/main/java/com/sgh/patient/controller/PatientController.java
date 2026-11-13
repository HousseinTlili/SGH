package com.sgh.patient.controller;

import com.sgh.patient.model.dto.AllergyPassportDto;
import com.sgh.patient.model.dto.PagedResponse;
import com.sgh.patient.model.dto.PatientInputDto;
import com.sgh.patient.model.dto.PatientResponseDto;
import com.sgh.patient.model.dto.PatientStatisticsDto;
import com.sgh.patient.model.dto.PatientSummaryDto;
import com.sgh.patient.model.dto.SimilarPatientDto;
import com.sgh.patient.service.PatientAllergyService;
import com.sgh.patient.service.PatientService;
import com.sgh.patient.service.PatientStatisticsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService patientService;
    private final PatientStatisticsService patientStatisticsService;
    private final PatientAllergyService patientAllergyService;

    public PatientController(
            PatientService patientService,
            PatientStatisticsService patientStatisticsService,
            PatientAllergyService patientAllergyService
    ) {
        this.patientService = patientService;
        this.patientStatisticsService = patientStatisticsService;
        this.patientAllergyService = patientAllergyService;
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
    public ResponseEntity<PatientResponseDto> createPatient(
            @Valid @RequestBody PatientInputDto input,
            Authentication authentication,
            HttpServletRequest request
    ) {
        PatientResponseDto created = patientService.createPatient(
                input,
                authentication,
                correlationId(request)
        );
        URI location = URI.create("/api/patients/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Must be declared before /{id} so "statistics" is not parsed as a UUID.
     * Aggregates active (not soft-deleted) rows in sgh_patient only.
     */
    @GetMapping("/statistics")
    public ResponseEntity<PatientStatisticsDto> statistics(
            @RequestParam(defaultValue = "LAST_12_MONTHS") String period,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "ALL") String ageGroup,
            @RequestParam(defaultValue = "ALL") String gender
    ) {
        return ResponseEntity.ok(patientStatisticsService.statistics(period, from, to, ageGroup, gender));
    }

    /**
     * Must be declared before /{id} so "similar" is not parsed as a UUID.
     * Advisory only: never blocks registration (PAT-2 409 stays on POST).
     */
    @GetMapping("/similar")
    public ResponseEntity<List<SimilarPatientDto>> findSimilar(
            @RequestParam String firstName,
            @RequestParam String lastName,
            @RequestParam(required = false) LocalDate birthDate,
            @RequestParam(required = false) UUID excludeId
    ) {
        return ResponseEntity.ok(patientService.findSimilar(firstName, lastName, birthDate, excludeId));
    }

    /**
     * Resolve Smart Allergy Passport by opaque QR token (no clinical data in the token itself).
     * Declared before /{id}.
     */
    @GetMapping("/passport/{passportToken}")
    public ResponseEntity<AllergyPassportDto> passportByToken(
            @PathVariable UUID passportToken,
            Authentication authentication
    ) {
        return ResponseEntity.ok(patientAllergyService.passportByToken(passportToken, authentication));
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
            @Valid @RequestBody PatientInputDto input,
            Authentication authentication,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(patientService.updatePatient(
                id,
                input,
                authentication,
                correlationId(request)
        ));
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

    private String correlationId(HttpServletRequest request) {
        Object id = request.getAttribute("correlationId");
        return id == null ? request.getHeader("X-Correlation-Id") : id.toString();
    }
}
