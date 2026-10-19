package com.sgh.patient.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiError {

    private Instant timestamp = Instant.now();
    private int status;
    private String error;
    private String message;
    private String path;
    private String correlationId;
    private String service;
    private List<FieldErrorDetail> details;

    public ApiError() {
    }

    public ApiError(int status, String error, String message, String path, String correlationId) {
        this.status = status;
        this.error = error;
        this.message = message;
        this.path = path;
        this.correlationId = correlationId;
        this.timestamp = Instant.now();
    }

    public ApiError(int status, String error, String message, String path, String correlationId, List<FieldErrorDetail> details) {
        this(status, error, message, path, correlationId);
        this.details = details;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public String getService() {
        return service;
    }

    public void setService(String service) {
        this.service = service;
    }

    public List<FieldErrorDetail> getDetails() {
        return details;
    }

    public void setDetails(List<FieldErrorDetail> details) {
        this.details = details;
    }

    public static class FieldErrorDetail {
        private String field;
        private String problem;

        public FieldErrorDetail() {
        }

        public FieldErrorDetail(String field, String problem) {
            this.field = field;
            this.problem = problem;
        }

        public String getField() {
            return field;
        }

        public void setField(String field) {
            this.field = field;
        }

        public String getProblem() {
            return problem;
        }

        public void setProblem(String problem) {
            this.problem = problem;
        }
    }
}
