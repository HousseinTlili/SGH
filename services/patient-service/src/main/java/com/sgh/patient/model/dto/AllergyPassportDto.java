package com.sgh.patient.model.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record AllergyPassportDto(
        UUID patientId,
        /** Opaque QR payload only — never contains allergen or clinical text. */
        UUID passportToken,
        String fullName,
        LocalDate birthDate,
        String bloodType,
        List<PatientAllergyResponseDto> allergies,
        Instant generatedAt
) {
}
