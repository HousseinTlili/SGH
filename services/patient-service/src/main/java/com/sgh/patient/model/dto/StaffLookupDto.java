package com.sgh.patient.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;

/** Response of GET /api/patients/staff/{staffId} (schema StaffLookup). */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record StaffLookupDto(UUID staffId, boolean available, String fullName, String role, String specialty, String source) {

    public static final String SOURCE_STAFF = "staff-service";
    public static final String SOURCE_FALLBACK = "fallback";

    public static StaffLookupDto fallback(UUID staffId) {
        return new StaffLookupDto(staffId, false, null, null, null, SOURCE_FALLBACK);
    }
}
