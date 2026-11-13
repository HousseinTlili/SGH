package com.sgh.patient.model.allergy;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "patient_allergy_history")
public class PatientAllergyHistory {

    @Id
    private UUID id;

    @Column(name = "allergy_id", nullable = false)
    private UUID allergyId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AllergyAuditAction action;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "before_snapshot", columnDefinition = "jsonb")
    private JsonNode beforeSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "after_snapshot", nullable = false, columnDefinition = "jsonb")
    private JsonNode afterSnapshot;

    @Column(name = "changed_by_username", nullable = false, length = 100)
    private String changedByUsername;

    @Column(name = "changed_by_role", nullable = false, length = 30)
    private String changedByRole;

    @Column(name = "correlation_id", nullable = false, length = 100)
    private String correlationId;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getAllergyId() { return allergyId; }
    public void setAllergyId(UUID allergyId) { this.allergyId = allergyId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public AllergyAuditAction getAction() { return action; }
    public void setAction(AllergyAuditAction action) { this.action = action; }
    public JsonNode getBeforeSnapshot() { return beforeSnapshot; }
    public void setBeforeSnapshot(JsonNode beforeSnapshot) { this.beforeSnapshot = beforeSnapshot; }
    public JsonNode getAfterSnapshot() { return afterSnapshot; }
    public void setAfterSnapshot(JsonNode afterSnapshot) { this.afterSnapshot = afterSnapshot; }
    public String getChangedByUsername() { return changedByUsername; }
    public void setChangedByUsername(String changedByUsername) { this.changedByUsername = changedByUsername; }
    public String getChangedByRole() { return changedByRole; }
    public void setChangedByRole(String changedByRole) { this.changedByRole = changedByRole; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    public Instant getChangedAt() { return changedAt; }
    public void setChangedAt(Instant changedAt) { this.changedAt = changedAt; }
}
