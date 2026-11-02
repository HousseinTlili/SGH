package com.sgh.staff.controller;

import com.sgh.staff.model.StaffRole;
import com.sgh.staff.model.dto.StaffDto;
import com.sgh.staff.model.dto.StaffInputDto;
import com.sgh.staff.model.dto.StaffPageDto;
import com.sgh.staff.model.dto.StaffPublicDto;
import com.sgh.staff.service.StaffService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/staff")
public class StaffController {

    private final StaffService staffService;

    public StaffController(StaffService staffService) {
        this.staffService = staffService;
    }

    /**
     * Route order requirement: /api/staff/directory MUST be declared and matched before /api/staff/{id}
     */
    @GetMapping("/directory")
    public ResponseEntity<List<StaffPublicDto>> getDirectory(@RequestParam(required = false) StaffRole role) {
        List<StaffPublicDto> directory = staffService.getDirectory(role);
        return ResponseEntity.ok(directory);
    }

    /**
     * Minimal public view of one active staff member
     */
    @GetMapping("/{id}/public")
    public ResponseEntity<StaffPublicDto> getPublicStaffById(@PathVariable UUID id) {
        StaffPublicDto publicDto = staffService.getPublicStaffById(id);
        return ResponseEntity.ok(publicDto);
    }

    /**
     * Deactivate a staff member (ADMIN only)
     */
    @PostMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffDto> deactivateStaff(@PathVariable UUID id) {
        StaffDto updated = staffService.deactivateStaff(id);
        return ResponseEntity.ok(updated);
    }

    /**
     * Get one staff profile (ADMIN only)
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffDto> getStaffById(@PathVariable UUID id) {
        StaffDto staff = staffService.getStaffById(id);
        return ResponseEntity.ok(staff);
    }

    /**
     * Update/replace a staff profile (ADMIN only)
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffDto> updateStaff(@PathVariable UUID id, @Valid @RequestBody StaffInputDto input) {
        StaffDto updated = staffService.updateStaff(id, input);
        return ResponseEntity.ok(updated);
    }

    /**
     * List staff profiles sorted by last name (ADMIN only)
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffPageDto> listStaff(
            @RequestParam(required = false) StaffRole role,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        StaffPageDto result = staffService.listStaff(role, department, active, search, page, size);
        return ResponseEntity.ok(result);
    }

    /**
     * Create a new staff profile (ADMIN only)
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffDto> createStaff(@Valid @RequestBody StaffInputDto input) {
        StaffDto created = staffService.createStaff(input);
        URI location = URI.create("/api/staff/" + created.id());
        return ResponseEntity.created(location).body(created);
    }
}
