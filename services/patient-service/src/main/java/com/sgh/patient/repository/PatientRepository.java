package com.sgh.patient.repository;

import com.sgh.patient.model.Patient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID> {

    Optional<Patient> findByIdAndDeletedFalse(UUID id);

    Page<Patient> findByDeletedFalse(Pageable pageable);

    @Query("SELECT p FROM Patient p WHERE p.deleted = false AND " +
           "(LOWER(p.firstName) LIKE LOWER(CONCAT('%', :term, '%')) OR " +
           "LOWER(p.lastName) LIKE LOWER(CONCAT('%', :term, '%')))")
    Page<Patient> search(@Param("term") String term, Pageable pageable);

    @Query("SELECT COUNT(p) > 0 FROM Patient p WHERE p.deleted = false AND " +
           "LOWER(p.firstName) = LOWER(:firstName) AND " +
           "LOWER(p.lastName) = LOWER(:lastName) AND " +
           "p.birthDate = :birthDate AND " +
           "(:excludeId IS NULL OR p.id != :excludeId)")
    boolean existsDuplicate(
            @Param("firstName") String firstName,
            @Param("lastName") String lastName,
            @Param("birthDate") LocalDate birthDate,
            @Param("excludeId") UUID excludeId
    );
}
