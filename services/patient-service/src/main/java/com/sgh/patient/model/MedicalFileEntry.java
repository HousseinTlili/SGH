package com.sgh.patient.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "medical_file_entries")
public class MedicalFileEntry {

    @Id
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private MedicalFileType type;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(name = "source_service", nullable = false, length = 50)
    private String sourceService;

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public MedicalFileEntry() {
    }

    public MedicalFileEntry(UUID id, UUID patientId, MedicalFileType type, String summary, String sourceService) {
        this.id = id;
        this.patientId = patientId;
        this.type = type;
        this.summary = summary;
        this.sourceService = sourceService;
        this.createdAt = Instant.now();
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
