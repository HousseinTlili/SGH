package com.sgh.patient.exception;

import com.sgh.patient.model.dto.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.ArrayList;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private String getCorrelationId(HttpServletRequest request) {
        String correlationId = (String) request.getAttribute("correlationId");
        if (correlationId == null) {
            correlationId = request.getHeader("X-Correlation-Id");
        }
        return correlationId != null ? correlationId : "unknown";
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        ApiError error = new ApiError(
                HttpStatus.NOT_FOUND.value(),
                "Not Found",
                ex.getMessage(),
                request.getRequestURI(),
                getCorrelationId(request)
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(PatientAlreadyExistsException.class)
    public ResponseEntity<ApiError> handleConflict(PatientAlreadyExistsException ex, HttpServletRequest request) {
        ApiError error = new ApiError(
                HttpStatus.CONFLICT.value(),
                "Conflict",
                ex.getMessage(),
                request.getRequestURI(),
                getCorrelationId(request)
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler({ForbiddenException.class, AccessDeniedException.class})
    public ResponseEntity<ApiError> handleForbidden(Exception ex, HttpServletRequest request) {
        ApiError error = new ApiError(
                HttpStatus.FORBIDDEN.value(),
                "Forbidden",
                "Your role is not allowed to do this",
                request.getRequestURI(),
                getCorrelationId(request)
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
    }

    @ExceptionHandler(DatabaseUnavailableException.class)
    public ResponseEntity<ApiError> handleDatabaseUnavailable(DatabaseUnavailableException ex, HttpServletRequest request) {
        ApiError error = new ApiError(
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "Service Unavailable",
                "Database unavailable",
                request.getRequestURI(),
                getCorrelationId(request)
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<ApiError.FieldErrorDetail> details = new ArrayList<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            details.add(new ApiError.FieldErrorDetail(fieldError.getField(), fieldError.getDefaultMessage()));
        }

        ApiError error = new ApiError(
                HttpStatus.UNPROCESSABLE_ENTITY.value(),
                "Unprocessable Entity",
                "Validation failed",
                request.getRequestURI(),
                getCorrelationId(request),
                details
        );
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(error);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> handleBadRequest(Exception ex, HttpServletRequest request) {
        ApiError error = new ApiError(
                HttpStatus.UNPROCESSABLE_ENTITY.value(),
                "Unprocessable Entity",
                "Validation failed: malformed input",
                request.getRequestURI(),
                getCorrelationId(request)
        );
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneral(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception processing request: {}", request.getRequestURI(), ex);
        ApiError error = new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Internal Server Error",
                "An unexpected error occurred",
                request.getRequestURI(),
                getCorrelationId(request)
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
