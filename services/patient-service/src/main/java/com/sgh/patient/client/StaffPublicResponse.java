package com.sgh.patient.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/** Body of Staff service GET /api/staff/{id}/public (schema StaffPublic in contracts/openapi/staff.yaml). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record StaffPublicResponse(UUID id, String fullName, String role, String specialty) {
}
