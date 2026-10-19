package com.sgh.staff.model.dto;

import com.sgh.staff.model.Role;
import java.util.UUID;

public record StaffPublicDto(
    UUID id,
    String fullName,
    Role role,
    String specialty
) {}
