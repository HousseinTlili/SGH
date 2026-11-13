package com.sgh.patient.client;

import java.util.UUID;

public record StaffPublicDto(
        UUID id,
        String name,
        String role,
        String department,
        String licenseNumber
) {}
