package com.sgh.patient.repository;

import com.sgh.patient.model.allergy.PatientAllergy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientAllergyRepository extends JpaRepository<PatientAllergy, UUID> {

    List<PatientAllergy> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    Optional<PatientAllergy> findByIdAndPatientId(UUID id, UUID patientId);
}
