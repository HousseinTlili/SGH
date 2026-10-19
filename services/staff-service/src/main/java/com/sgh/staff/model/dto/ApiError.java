package com.sgh.staff.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
    Instant timestamp,
    int status,
    String error,
    String message,
    String path,
    String correlationId,
    String service,
    List<FieldProblem> details
) {
    public ApiError(int status, String error, String message, String path, String correlationId) {
        this(Instant.now(), status, error, message, path, correlationId, null, null);
    }

    public ApiError(int status, String error, String message, String path, String correlationId, List<FieldProblem> details) {
        this(Instant.now(), status, error, message, path, correlationId, null, details);
    }

    public record FieldProblem(String field, String problem) {}
}
