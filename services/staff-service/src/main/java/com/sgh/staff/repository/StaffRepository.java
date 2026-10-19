package com.sgh.staff.repository;

import com.sgh.staff.model.StaffMember;
import com.sgh.staff.model.StaffRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StaffRepository extends JpaRepository<StaffMember, UUID>, JpaSpecificationExecutor<StaffMember> {

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, UUID id);

    List<StaffMember> findByActiveTrueOrderByFirstNameAscLastNameAsc();

    List<StaffMember> findByActiveTrueAndRoleOrderByFirstNameAscLastNameAsc(StaffRole role);

    Optional<StaffMember> findByIdAndActiveTrue(UUID id);
}
