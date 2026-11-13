package com.sgh.patient.controller;

import com.sgh.patient.model.dto.StaffLookupDto;
import com.sgh.patient.service.StaffLookupService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** GET /api/patients/staff/{staffId}: the OpenFeign call to Staff service (roles in SecurityConfig). */
@RestController
@RequestMapping("/api/patients/staff")
public class StaffLookupController {

    private final StaffLookupService staffLookupService;

    public StaffLookupController(StaffLookupService staffLookupService) {
        this.staffLookupService = staffLookupService;
    }

    @GetMapping("/{staffId}")
    public ResponseEntity<StaffLookupDto> lookup(@PathVariable UUID staffId) {
        return ResponseEntity.ok(staffLookupService.lookup(staffId));
    }
}
