package com.sgh.patient.model.dto;

import java.time.LocalDate;
import java.util.UUID;

public class PatientSummaryDto {

    private UUID id;
    private String fullName;
    private LocalDate birthDate;

    public PatientSummaryDto() {
    }

    public PatientSummaryDto(UUID id, String fullName, LocalDate birthDate) {
        this.id = id;
        this.fullName = fullName;
        this.birthDate = birthDate;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }
}
