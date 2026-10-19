package com.sgh.staff.model.dto;

import com.sgh.staff.model.Role;
import java.util.List;
import java.util.UUID;

public record StaffMeDto(
    String username,
    List<Role> roles,
    MeStaffProfile staff,
    UUID patientId
) {
    public record MeStaffProfile(
        UUID id,
        String fullName,
        Role role,
        String specialty,
        String department
    ) {}
}
