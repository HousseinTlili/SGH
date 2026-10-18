package com.sgh.patient.exception;

public class DatabaseUnavailableException extends RuntimeException {
    public DatabaseUnavailableException(String message) {
        super(message);
    }
}
