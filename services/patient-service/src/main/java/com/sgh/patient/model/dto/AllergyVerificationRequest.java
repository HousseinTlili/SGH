package com.sgh.patient.model.dto;

import com.sgh.patient.model.allergy.VerificationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record AllergyVerificationRequest(
        @NotNull VerificationStatus verificationStatus,
        @NotNull @PositiveOrZero Long version
) {
}
