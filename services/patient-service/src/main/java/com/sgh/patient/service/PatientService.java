package com.sgh.patient.service;

import com.sgh.patient.exception.ForbiddenException;
import com.sgh.patient.exception.PatientAlreadyExistsException;
import com.sgh.patient.exception.ResourceNotFoundException;
import com.sgh.patient.model.MedicalFileEntry;
import com.sgh.patient.model.MedicalFileType;
import com.sgh.patient.model.Patient;
import com.sgh.patient.model.dto.*;
import com.sgh.patient.repository.MedicalFileEntryRepository;
import com.sgh.patient.repository.PatientRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PatientService {

    private final PatientRepository patientRepository;
    private final MedicalFileEntryRepository medicalFileEntryRepository;

    public PatientService(PatientRepository patientRepository, MedicalFileEntryRepository medicalFileEntryRepository) {
        this.patientRepository = patientRepository;
        this.medicalFileEntryRepository = medicalFileEntryRepository;
    }

    private boolean isPatientRole(Authentication auth) {
        if (auth == null) return false;
        for (GrantedAuthority authority : auth.getAuthorities()) {
            if ("ROLE_PATIENT".equals(authority.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    private void checkPatientOwnership(UUID targetPatientId, Authentication auth) {
        if (isPatientRole(auth)) {
            if (auth.getPrincipal() instanceof Jwt jwt) {
                String tokenPatientId = jwt.getClaimAsString("patientId");
                if (tokenPatientId == null || !tokenPatientId.equalsIgnoreCase(targetPatientId.toString())) {
                    throw new ForbiddenException("Patients may only access their own record");
                }
            } else {
                throw new ForbiddenException("Patients may only access their own record");
            }
        }
    }

    private PatientResponseDto toPatientResponseDto(Patient p) {
        PatientResponseDto dto = new PatientResponseDto();
        dto.setId(p.getId());
        dto.setFirstName(p.getFirstName());
        dto.setLastName(p.getLastName());
        dto.setBirthDate(p.getBirthDate());
        dto.setGender(p.getGender());
        dto.setPhone(p.getPhone());
        dto.setEmail(p.getEmail());
        dto.setAddress(p.getAddress());
        dto.setBloodType(p.getBloodType());
        dto.setAllergies(p.getAllergies());
        dto.setInsuranceProvider(p.getInsuranceProvider());
        dto.setInsuranceNumber(p.getInsuranceNumber());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    private MedicalFileEntryDto toMedicalFileEntryDto(MedicalFileEntry e) {
        MedicalFileEntryDto dto = new MedicalFileEntryDto();
        dto.setId(e.getId());
        dto.setPatientId(e.getPatientId());
        dto.setType(e.getType());
        dto.setSummary(e.getSummary());
        dto.setSourceService(e.getSourceService());
        dto.setReferenceId(e.getReferenceId());
        dto.setCreatedAt(e.getCreatedAt());
        return dto;
    }

    @Transactional(readOnly = true)
    public PagedResponse<PatientResponseDto> listPatients(String search, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by("lastName").ascending().and(Sort.by("firstName").ascending()));

        Page<Patient> resultPage;
        if (search != null && !search.trim().isEmpty()) {
            resultPage = patientRepository.search(search.trim(), pageable);
        } else {
            resultPage = patientRepository.findByDeletedFalse(pageable);
        }

        List<PatientResponseDto> dtos = resultPage.getContent().stream()
                .map(this::toPatientResponseDto)
                .toList();

        return new PagedResponse<>(dtos, resultPage.getNumber(), resultPage.getSize(), resultPage.getTotalElements(), resultPage.getTotalPages());
    }

    public PatientResponseDto createPatient(PatientInputDto input) {
        boolean duplicate = patientRepository.existsDuplicate(
                input.getFirstName().trim(),
                input.getLastName().trim(),
                input.getBirthDate(),
                null
        );

        if (duplicate) {
            throw new PatientAlreadyExistsException("A patient with the same name and birth date already exists");
        }

        UUID id = UUID.randomUUID();
        Patient patient = new Patient(
                id,
                input.getFirstName().trim(),
                input.getLastName().trim(),
                input.getBirthDate(),
                input.getGender()
        );
        patient.setPhone(input.getPhone());
        patient.setEmail(input.getEmail());
        patient.setAddress(input.getAddress());
        patient.setBloodType(input.getBloodType());
        patient.setAllergies(input.getAllergies());
        patient.setInsuranceProvider(input.getInsuranceProvider());
        patient.setInsuranceNumber(input.getInsuranceNumber());
        patient.setDeleted(false);
        patient.setCreatedAt(Instant.now());
        patient.setUpdatedAt(Instant.now());

        Patient saved = patientRepository.save(patient);
        return toPatientResponseDto(saved);
    }

    @Transactional(readOnly = true)
    public PatientResponseDto getPatient(UUID id, Authentication auth) {
        Patient patient = patientRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        checkPatientOwnership(id, auth);

        return toPatientResponseDto(patient);
    }

    public PatientResponseDto updatePatient(UUID id, PatientInputDto input) {
        Patient patient = patientRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        boolean duplicate = patientRepository.existsDuplicate(
                input.getFirstName().trim(),
                input.getLastName().trim(),
                input.getBirthDate(),
                id
        );

        if (duplicate) {
            throw new PatientAlreadyExistsException("A patient with the same name and birth date already exists");
        }

        patient.setFirstName(input.getFirstName().trim());
        patient.setLastName(input.getLastName().trim());
        patient.setBirthDate(input.getBirthDate());
        patient.setGender(input.getGender());
        patient.setPhone(input.getPhone());
        patient.setEmail(input.getEmail());
        patient.setAddress(input.getAddress());
        patient.setBloodType(input.getBloodType());
        patient.setAllergies(input.getAllergies());
        patient.setInsuranceProvider(input.getInsuranceProvider());
        patient.setInsuranceNumber(input.getInsuranceNumber());
        patient.setUpdatedAt(Instant.now());

        Patient saved = patientRepository.save(patient);
        return toPatientResponseDto(saved);
    }

    public void deletePatient(UUID id) {
        Patient patient = patientRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        patient.setDeleted(true);
        patient.setDeletedAt(Instant.now());
        patient.setUpdatedAt(Instant.now());
        patientRepository.save(patient);
    }

    @Transactional(readOnly = true)
    public PatientSummaryDto getPatientSummary(UUID id, Authentication auth) {
        Patient patient = patientRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        checkPatientOwnership(id, auth);

        String fullName = patient.getFirstName() + " " + patient.getLastName();
        return new PatientSummaryDto(patient.getId(), fullName, patient.getBirthDate());
    }

    @Transactional(readOnly = true)
    public PagedResponse<MedicalFileEntryDto> listMedicalFile(UUID patientId, MedicalFileType type, int page, int size, Authentication auth) {
        if (!patientRepository.findByIdAndDeletedFalse(patientId).isPresent()) {
            throw new ResourceNotFoundException("Patient not found");
        }

        checkPatientOwnership(patientId, auth);

        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by("createdAt").descending());

        Page<MedicalFileEntry> entries;
        if (type != null) {
            entries = medicalFileEntryRepository.findByPatientIdAndTypeOrderByCreatedAtDesc(patientId, type, pageable);
        } else {
            entries = medicalFileEntryRepository.findByPatientIdOrderByCreatedAtDesc(patientId, pageable);
        }

        List<MedicalFileEntryDto> dtos = entries.getContent().stream()
                .map(this::toMedicalFileEntryDto)
                .toList();

        return new PagedResponse<>(dtos, entries.getNumber(), entries.getSize(), entries.getTotalElements(), entries.getTotalPages());
    }

    public MedicalFileEntryDto addMedicalFileNote(UUID patientId, String summary) {
        if (!patientRepository.findByIdAndDeletedFalse(patientId).isPresent()) {
            throw new ResourceNotFoundException("Patient not found");
        }

        UUID id = UUID.randomUUID();
        MedicalFileEntry entry = new MedicalFileEntry(
                id,
                patientId,
                MedicalFileType.NOTE,
                summary,
                "patient"
        );
        entry.setCreatedAt(Instant.now());

        MedicalFileEntry saved = medicalFileEntryRepository.save(entry);
        return toMedicalFileEntryDto(saved);
    }
}
