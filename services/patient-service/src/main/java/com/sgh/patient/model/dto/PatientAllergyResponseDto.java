package com.sgh.patient.model.dto;

import com.sgh.patient.model.allergy.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PatientAllergyResponseDto(
        UUID id,
        UUID patientId,
        String allergen,
        AllergyCategory category,
        String observedReaction,
        LocalDate reactionDate,
        ReactionSeverity reactionSeverity,
        ClinicalStatus clinicalStatus,
        VerificationStatus verificationStatus,
        Criticality criticality,
        String recordedByUsername,
        String recordedByRole,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
