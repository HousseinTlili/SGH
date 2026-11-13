package com.sgh.patient.exception;

import com.sgh.patient.model.dto.ApiError;

import java.util.List;

public class UnprocessableException extends RuntimeException {

    private final List<ApiError.FieldErrorDetail> details;

    public UnprocessableException(String message, String field, String problem) {
        super(message);
        this.details = List.of(new ApiError.FieldErrorDetail(field, problem));
    }

    public List<ApiError.FieldErrorDetail> getDetails() {
        return details;
    }
}
