package com.sgh.patient.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgh.patient.exception.ConflictException;
import com.sgh.patient.exception.ForbiddenException;
import com.sgh.patient.exception.ResourceNotFoundException;
import com.sgh.patient.exception.UnprocessableException;
import com.sgh.patient.model.Patient;
import com.sgh.patient.model.allergy.*;
import com.sgh.patient.model.dto.*;
import com.sgh.patient.repository.PatientAllergyHistoryRepository;
import com.sgh.patient.repository.PatientAllergyRepository;
import com.sgh.patient.repository.PatientRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PatientAllergyService {

    private final PatientRepository patientRepository;
    private final PatientAllergyRepository allergyRepository;
    private final PatientAllergyHistoryRepository historyRepository;
    private final ObjectMapper objectMapper;

    public PatientAllergyService(
            PatientRepository patientRepository,
            PatientAllergyRepository allergyRepository,
            PatientAllergyHistoryRepository historyRepository,
            ObjectMapper objectMapper
    ) {
        this.patientRepository = patientRepository;
        this.allergyRepository = allergyRepository;
        this.historyRepository = historyRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<PatientAllergyResponseDto> list(UUID patientId, Authentication authentication) {
        requirePatient(patientId);
        checkPatientOwnership(patientId, authentication);
        return allergyRepository.findByPatientIdOrderByCreatedAtDesc(patientId).stream()
                .sorted(Comparator
                        .comparing((PatientAllergy a) -> a.getClinicalStatus() != ClinicalStatus.ACTIVE)
                        .thenComparing(a -> a.getVerificationStatus() == VerificationStatus.REFUTED)
                        .thenComparing(PatientAllergy::getCreatedAt, Comparator.reverseOrder()))
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public PatientAllergyResponseDto get(UUID patientId, UUID allergyId, Authentication authentication) {
        requirePatient(patientId);
        checkPatientOwnership(patientId, authentication);
        return toDto(requireAllergy(patientId, allergyId));
    }

    public PatientAllergyResponseDto create(
            UUID patientId,
            PatientAllergyInputDto input,
            Authentication authentication,
            String correlationId
    ) {
        requirePatient(patientId);
        boolean doctor = hasRole(authentication, "DOCTOR");
        boolean receptionist = hasRole(authentication, "RECEPTIONIST");
        if (!doctor && !receptionist) {
            throw new ForbiddenException("Only receptionists and doctors may record allergies");
        }

        PatientAllergy allergy = new PatientAllergy();
        allergy.setId(UUID.randomUUID());
        allergy.setPatientId(patientId);
        applyInput(allergy, input);
        allergy.setVerificationStatus(doctor ? VerificationStatus.UNCONFIRMED : VerificationStatus.DECLARED);
        allergy.setRecordedByUsername(username(authentication));
        allergy.setRecordedByRole(primaryRole(authentication));
        Instant now = Instant.now();
        allergy.setCreatedAt(now);
        allergy.setUpdatedAt(now);
        PatientAllergy saved = allergyRepository.saveAndFlush(allergy);
        audit(saved, AllergyAuditAction.CREATE, null, authentication, correlationId);
        refreshLegacyProjection(patientId);
        return toDto(saved);
    }

    public PatientAllergyResponseDto update(
            UUID patientId,
            UUID allergyId,
            PatientAllergyInputDto input,
            Authentication authentication,
            String correlationId
    ) {
        requirePatient(patientId);
        PatientAllergy allergy = requireAllergy(patientId, allergyId);
        boolean doctor = hasRole(authentication, "DOCTOR");
        boolean receptionist = hasRole(authentication, "RECEPTIONIST");
        if (!doctor && !(receptionist && allergy.getVerificationStatus() == VerificationStatus.DECLARED)) {
            throw new ForbiddenException("Receptionists may update only declared allergies; clinical updates require a doctor");
        }
        requireVersion(allergy, input.version());
        JsonNode before = snapshot(allergy);
        applyInput(allergy, input);
        allergy.setUpdatedAt(Instant.now());
        PatientAllergy saved = allergyRepository.saveAndFlush(allergy);
        audit(saved, AllergyAuditAction.UPDATE, before, authentication, correlationId);
        refreshLegacyProjection(patientId);
        return toDto(saved);
    }

    public PatientAllergyResponseDto verify(
            UUID patientId,
            UUID allergyId,
            AllergyVerificationRequest request,
            Authentication authentication,
            String correlationId
    ) {
        if (!hasRole(authentication, "DOCTOR")) {
            throw new ForbiddenException("Only doctors may confirm or refute allergies");
        }
        requirePatient(patientId);
        PatientAllergy allergy = requireAllergy(patientId, allergyId);
        requireVersion(allergy, request.version());
        if (request.verificationStatus() != VerificationStatus.CONFIRMED
                && request.verificationStatus() != VerificationStatus.REFUTED) {
            throw new UnprocessableException(
                    "Validation failed",
                    "verificationStatus",
                    "must be CONFIRMED or REFUTED"
            );
        }
        JsonNode before = snapshot(allergy);
        allergy.setVerificationStatus(request.verificationStatus());
        allergy.setUpdatedAt(Instant.now());
        PatientAllergy saved = allergyRepository.saveAndFlush(allergy);
        AllergyAuditAction action = request.verificationStatus() == VerificationStatus.CONFIRMED
                ? AllergyAuditAction.CONFIRM
                : AllergyAuditAction.REFUTE;
        audit(saved, action, before, authentication, correlationId);
        refreshLegacyProjection(patientId);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<AllergyHistoryDto> history(UUID patientId, UUID allergyId) {
        requirePatient(patientId);
        requireAllergy(patientId, allergyId);
        return historyRepository.findByAllergyIdOrderByChangedAtDesc(allergyId).stream()
                .map(h -> new AllergyHistoryDto(
                        h.getId(),
                        h.getAllergyId(),
                        h.getPatientId(),
                        h.getAction(),
                        h.getBeforeSnapshot(),
                        h.getAfterSnapshot(),
                        h.getChangedByUsername(),
                        h.getChangedByRole(),
                        h.getCorrelationId(),
                        h.getChangedAt()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public AllergyPassportDto passport(UUID patientId, Authentication authentication) {
        Patient patient = requirePatient(patientId);
        checkPatientOwnership(patientId, authentication);
        List<PatientAllergyResponseDto> allergies = allergyRepository
                .findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .filter(a -> a.getClinicalStatus() == ClinicalStatus.ACTIVE)
                .filter(a -> a.getVerificationStatus() != VerificationStatus.REFUTED)
                .map(this::toDto)
                .toList();
        return toPassport(patient, allergies);
    }

    @Transactional(readOnly = true)
    public AllergyPassportDto passportByToken(UUID passportToken, Authentication authentication) {
        Patient patient = patientRepository.findByPassportTokenAndDeletedFalse(passportToken)
                .orElseThrow(() -> new ResourceNotFoundException("Allergy passport not found"));
        return passport(patient.getId(), authentication);
    }

    private AllergyPassportDto toPassport(Patient patient, List<PatientAllergyResponseDto> allergies) {
        UUID token = patient.getPassportToken();
        if (token == null) {
            token = UUID.randomUUID();
            patient.setPassportToken(token);
            patientRepository.save(patient);
        }
        return new AllergyPassportDto(
                patient.getId(),
                token,
                patient.getFirstName() + " " + patient.getLastName(),
                patient.getBirthDate(),
                patient.getBloodType(),
                allergies,
                Instant.now()
        );
    }

    public void importLegacyAllergy(Patient patient, String legacyText, Authentication authentication, String correlationId) {
        if (legacyText == null || legacyText.isBlank()) {
            return;
        }
        boolean alreadyRepresented = allergyRepository.findByPatientIdOrderByCreatedAtDesc(patient.getId()).stream()
                .anyMatch(a -> a.getAllergen().equalsIgnoreCase(legacyText.trim()));
        if (alreadyRepresented) {
            refreshLegacyProjection(patient.getId());
            return;
        }
        PatientAllergy allergy = new PatientAllergy();
        allergy.setId(UUID.randomUUID());
        allergy.setPatientId(patient.getId());
        allergy.setAllergen(legacyText.trim());
        allergy.setClinicalStatus(ClinicalStatus.ACTIVE);
        allergy.setVerificationStatus(VerificationStatus.DECLARED);
        allergy.setCriticality(Criticality.UNABLE_TO_ASSESS);
        allergy.setRecordedByUsername(username(authentication));
        allergy.setRecordedByRole(primaryRole(authentication));
        allergy.setCreatedAt(Instant.now());
        allergy.setUpdatedAt(Instant.now());
        PatientAllergy saved = allergyRepository.saveAndFlush(allergy);
        audit(saved, AllergyAuditAction.CREATE, null, authentication, correlationId);
        refreshLegacyProjection(patient.getId());
    }

    private void applyInput(PatientAllergy allergy, PatientAllergyInputDto input) {
        allergy.setAllergen(input.allergen().trim());
        allergy.setCategory(input.category());
        allergy.setObservedReaction(blankToNull(input.observedReaction()));
        allergy.setReactionDate(input.reactionDate());
        allergy.setReactionSeverity(input.reactionSeverity());
        allergy.setClinicalStatus(input.clinicalStatus());
        allergy.setCriticality(input.criticality());
    }

    private void requireVersion(PatientAllergy allergy, long requestedVersion) {
        if (allergy.getVersion() != requestedVersion) {
            throw new ConflictException("Allergy record was modified by another user; reload and try again");
        }
    }

    private Patient requirePatient(UUID patientId) {
        return patientRepository.findByIdAndDeletedFalse(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));
    }

    private PatientAllergy requireAllergy(UUID patientId, UUID allergyId) {
        return allergyRepository.findByIdAndPatientId(allergyId, patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Allergy not found"));
    }

    private void audit(
            PatientAllergy allergy,
            AllergyAuditAction action,
            JsonNode before,
            Authentication authentication,
            String correlationId
    ) {
        PatientAllergyHistory entry = new PatientAllergyHistory();
        entry.setId(UUID.randomUUID());
        entry.setAllergyId(allergy.getId());
        entry.setPatientId(allergy.getPatientId());
        entry.setAction(action);
        entry.setBeforeSnapshot(before);
        entry.setAfterSnapshot(snapshot(allergy));
        entry.setChangedByUsername(username(authentication));
        entry.setChangedByRole(primaryRole(authentication));
        entry.setCorrelationId(correlationId == null || correlationId.isBlank() ? "unknown" : correlationId);
        entry.setChangedAt(Instant.now());
        historyRepository.save(entry);
    }

    private JsonNode snapshot(PatientAllergy allergy) {
        return objectMapper.valueToTree(toDto(allergy));
    }

    private void refreshLegacyProjection(UUID patientId) {
        Patient patient = requirePatient(patientId);
        String projection = allergyRepository.findByPatientIdOrderByCreatedAtDesc(patientId).stream()
                .filter(a -> a.getClinicalStatus() == ClinicalStatus.ACTIVE)
                .filter(a -> a.getVerificationStatus() != VerificationStatus.REFUTED)
                .map(PatientAllergy::getAllergen)
                .distinct()
                .reduce((left, right) -> left + ", " + right)
                .orElse(null);
        patient.setAllergies(projection);
        patient.setUpdatedAt(Instant.now());
        patientRepository.save(patient);
    }

    private void checkPatientOwnership(UUID patientId, Authentication authentication) {
        if (!hasRole(authentication, "PATIENT")) {
            return;
        }
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            String tokenPatientId = jwt.getClaimAsString("patientId");
            if (tokenPatientId != null && tokenPatientId.equalsIgnoreCase(patientId.toString())) {
                return;
            }
        }
        throw new ForbiddenException("Patients may only access their own allergy passport");
    }

    private boolean hasRole(Authentication authentication, String role) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(("ROLE_" + role)::equals);
    }

    private String primaryRole(Authentication authentication) {
        if (authentication == null) {
            return "SYSTEM";
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring(5))
                .sorted()
                .findFirst()
                .orElse("AUTHENTICATED");
    }

    private String username(Authentication authentication) {
        return authentication == null || authentication.getName() == null
                ? "system"
                : authentication.getName();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private PatientAllergyResponseDto toDto(PatientAllergy allergy) {
        return new PatientAllergyResponseDto(
                allergy.getId(),
                allergy.getPatientId(),
                allergy.getAllergen(),
                allergy.getCategory(),
                allergy.getObservedReaction(),
                allergy.getReactionDate(),
                allergy.getReactionSeverity(),
                allergy.getClinicalStatus(),
                allergy.getVerificationStatus(),
                allergy.getCriticality(),
                allergy.getRecordedByUsername(),
                allergy.getRecordedByRole(),
                allergy.getCreatedAt(),
                allergy.getUpdatedAt(),
                allergy.getVersion()
        );
    }
}
