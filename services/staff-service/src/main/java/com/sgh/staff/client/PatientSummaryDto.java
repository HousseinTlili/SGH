package com.sgh.staff.client;

import java.util.UUID;

public record PatientSummaryDto(
        UUID id,
        String firstName,
        String lastName,
        String birthDate,
        String nationalId,
        String phone
) {}
