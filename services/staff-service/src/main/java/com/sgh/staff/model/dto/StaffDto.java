package com.sgh.staff.model.dto;

import com.sgh.staff.model.StaffRole;
import java.time.Instant;
import java.util.UUID;

public record StaffDto(
    UUID id,
    UUID keycloakUserId,
    String firstName,
    String lastName,
    StaffRole role,
    String specialty,
    String department,
    String email,
    boolean active,
    Instant createdAt,
    Instant updatedAt
) {}
