package com.sgh.patient.model.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.sgh.patient.model.allergy.AllergyAuditAction;

import java.time.Instant;
import java.util.UUID;

public record AllergyHistoryDto(
        UUID id,
        UUID allergyId,
        UUID patientId,
        AllergyAuditAction action,
        JsonNode beforeSnapshot,
        JsonNode afterSnapshot,
        String changedByUsername,
        String changedByRole,
        String correlationId,
        Instant changedAt
) {
}
