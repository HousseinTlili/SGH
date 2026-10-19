package com.sgh.patient.model.dto;

import com.sgh.patient.model.MedicalFileType;
import java.time.Instant;
import java.util.UUID;

public class MedicalFileEntryDto {

    private UUID id;
    private UUID patientId;
    private MedicalFileType type;
    private String summary;
    private String sourceService;
    private UUID referenceId;
    private Instant createdAt;

    public MedicalFileEntryDto() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public MedicalFileType getType() {
        return type;
    }

    public void setType(MedicalFileType type) {
        this.type = type;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getSourceService() {
        return sourceService;
    }

    public void setSourceService(String sourceService) {
        this.sourceService = sourceService;
    }

    public UUID getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(UUID referenceId) {
        this.referenceId = referenceId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
