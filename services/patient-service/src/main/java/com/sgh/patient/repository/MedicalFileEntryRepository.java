package com.sgh.patient.repository;

import com.sgh.patient.model.MedicalFileEntry;
import com.sgh.patient.model.MedicalFileType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface MedicalFileEntryRepository extends JpaRepository<MedicalFileEntry, UUID> {

    Page<MedicalFileEntry> findByPatientIdOrderByCreatedAtDesc(UUID patientId, Pageable pageable);

    Page<MedicalFileEntry> findByPatientIdAndTypeOrderByCreatedAtDesc(UUID patientId, MedicalFileType type, Pageable pageable);
}
