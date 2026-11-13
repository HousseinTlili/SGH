package com.sgh.patient.model.dto;

import com.sgh.patient.model.allergy.AllergyCategory;
import com.sgh.patient.model.allergy.ClinicalStatus;
import com.sgh.patient.model.allergy.Criticality;
import com.sgh.patient.model.allergy.ReactionSeverity;
import jakarta.validation.constraints.*;

import java.time.LocalDate;

public record PatientAllergyInputDto(
        @NotBlank @Size(max = 255) String allergen,
        @NotNull AllergyCategory category,
        @Size(max = 500) String observedReaction,
        @PastOrPresent LocalDate reactionDate,
        ReactionSeverity reactionSeverity,
        @NotNull ClinicalStatus clinicalStatus,
        @NotNull Criticality criticality,
        @NotNull @PositiveOrZero Long version
) {
}
