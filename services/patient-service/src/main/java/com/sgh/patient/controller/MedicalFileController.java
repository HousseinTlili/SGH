package com.sgh.patient.controller;

import com.sgh.patient.model.MedicalFileType;
import com.sgh.patient.model.dto.CreateMedicalFileNoteRequest;
import com.sgh.patient.model.dto.MedicalFileEntryDto;
import com.sgh.patient.model.dto.PagedResponse;
import com.sgh.patient.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/patients/{id}/medical-file")
public class MedicalFileController {

    private final PatientService patientService;

    public MedicalFileController(PatientService patientService) {
        this.patientService = patientService;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<MedicalFileEntryDto>> listMedicalFile(
            @PathVariable UUID id,
            @RequestParam(required = false) MedicalFileType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        return ResponseEntity.ok(patientService.listMedicalFile(id, type, page, size, authentication));
    }

    @PostMapping
    public ResponseEntity<MedicalFileEntryDto> addNote(
            @PathVariable UUID id,
            @Valid @RequestBody CreateMedicalFileNoteRequest request
    ) {
        MedicalFileEntryDto created = patientService.addMedicalFileNote(id, request.getSummary());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
