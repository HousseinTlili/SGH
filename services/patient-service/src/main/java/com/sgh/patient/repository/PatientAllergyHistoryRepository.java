package com.sgh.patient.repository;

import com.sgh.patient.model.allergy.PatientAllergyHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PatientAllergyHistoryRepository extends JpaRepository<PatientAllergyHistory, UUID> {

    List<PatientAllergyHistory> findByAllergyIdOrderByChangedAtDesc(UUID allergyId);
}
