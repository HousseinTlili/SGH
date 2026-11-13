package com.sgh.patient.model.allergy;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "patient_allergies")
public class PatientAllergy {

    @Id
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(nullable = false, length = 255)
    private String allergen;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private AllergyCategory category;

    @Column(name = "observed_reaction", length = 500)
    private String observedReaction;

    @Column(name = "reaction_date")
    private LocalDate reactionDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "reaction_severity", length = 20)
    private ReactionSeverity reactionSeverity;

    @Enumerated(EnumType.STRING)
    @Column(name = "clinical_status", nullable = false, length = 20)
    private ClinicalStatus clinicalStatus = ClinicalStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private VerificationStatus verificationStatus = VerificationStatus.DECLARED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Criticality criticality = Criticality.UNABLE_TO_ASSESS;

    @Column(name = "recorded_by_username", nullable = false, length = 100)
    private String recordedByUsername;

    @Column(name = "recorded_by_role", nullable = false, length = 30)
    private String recordedByRole;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getAllergen() { return allergen; }
    public void setAllergen(String allergen) { this.allergen = allergen; }
    public AllergyCategory getCategory() { return category; }
    public void setCategory(AllergyCategory category) { this.category = category; }
    public String getObservedReaction() { return observedReaction; }
    public void setObservedReaction(String observedReaction) { this.observedReaction = observedReaction; }
    public LocalDate getReactionDate() { return reactionDate; }
    public void setReactionDate(LocalDate reactionDate) { this.reactionDate = reactionDate; }
    public ReactionSeverity getReactionSeverity() { return reactionSeverity; }
    public void setReactionSeverity(ReactionSeverity reactionSeverity) { this.reactionSeverity = reactionSeverity; }
    public ClinicalStatus getClinicalStatus() { return clinicalStatus; }
    public void setClinicalStatus(ClinicalStatus clinicalStatus) { this.clinicalStatus = clinicalStatus; }
    public VerificationStatus getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(VerificationStatus verificationStatus) { this.verificationStatus = verificationStatus; }
    public Criticality getCriticality() { return criticality; }
    public void setCriticality(Criticality criticality) { this.criticality = criticality; }
    public String getRecordedByUsername() { return recordedByUsername; }
    public void setRecordedByUsername(String recordedByUsername) { this.recordedByUsername = recordedByUsername; }
    public String getRecordedByRole() { return recordedByRole; }
    public void setRecordedByRole(String recordedByRole) { this.recordedByRole = recordedByRole; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
}
