package com.sgh.staff.service;

import com.sgh.staff.exception.ConflictException;
import com.sgh.staff.exception.ResourceNotFoundException;
import com.sgh.staff.model.Role;
import com.sgh.staff.model.StaffMember;
import com.sgh.staff.model.StaffRole;
import com.sgh.staff.model.dto.*;
import com.sgh.staff.repository.StaffRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Transactional
public class StaffService {

    private static final Set<String> SGH_ROLES = Set.of(
            "PATIENT", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "RECEPTIONIST", "ADMIN"
    );

    private final StaffRepository staffRepository;

    public StaffService(StaffRepository staffRepository) {
        this.staffRepository = staffRepository;
    }

    @Transactional(readOnly = true)
    public StaffPageDto listStaff(StaffRole role, String department, Boolean active, String search, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("lastName").ascending());

        Specification<StaffMember> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (role != null) {
                predicates.add(cb.equal(root.get("role"), role));
            }

            if (department != null && !department.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("department")), department.trim().toLowerCase()));
            }

            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate firstMatch = cb.like(cb.lower(root.get("firstName")), pattern);
                Predicate lastMatch = cb.like(cb.lower(root.get("lastName")), pattern);
                predicates.add(cb.or(firstMatch, lastMatch));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<StaffMember> pageResult = staffRepository.findAll(spec, pageable);
        List<StaffDto> content = pageResult.getContent().stream()
                .map(this::toDto)
                .toList();

        return new StaffPageDto(
                content,
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages()
        );
    }

    public StaffDto createStaff(StaffInputDto input) {
        String email = input.email().trim().toLowerCase();
        if (staffRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("This e-mail is already used");
        }

        StaffMember member = new StaffMember();
        member.setId(UUID.randomUUID());
        member.setKeycloakUserId(input.keycloakUserId());
        member.setFirstName(input.firstName().trim());
        member.setLastName(input.lastName().trim());
        member.setRole(input.role());
        member.setSpecialty(input.specialty() != null && !input.specialty().isBlank() ? input.specialty().trim() : null);
        member.setDepartment(input.department().trim());
        member.setEmail(email);
        member.setActive(true);
        member.setCreatedAt(Instant.now());
        member.setUpdatedAt(Instant.now());

        StaffMember saved = staffRepository.save(member);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public StaffDto getStaffById(UUID id) {
        StaffMember member = staffRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found"));
        return toDto(member);
    }

    public StaffDto updateStaff(UUID id, StaffInputDto input) {
        StaffMember member = staffRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found"));

        String email = input.email().trim().toLowerCase();
        if (staffRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw new ConflictException("This e-mail is already used");
        }

        member.setFirstName(input.firstName().trim());
        member.setLastName(input.lastName().trim());
        member.setRole(input.role());
        member.setSpecialty(input.specialty() != null && !input.specialty().isBlank() ? input.specialty().trim() : null);
        member.setDepartment(input.department().trim());
        member.setEmail(email);
        member.setKeycloakUserId(input.keycloakUserId());
        member.setUpdatedAt(Instant.now());

        StaffMember saved = staffRepository.save(member);
        return toDto(saved);
    }

    public StaffDto deactivateStaff(UUID id) {
        StaffMember member = staffRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found"));

        if (!member.isActive()) {
            throw new ConflictException("Staff member is already inactive");
        }

        member.setActive(false);
        member.setUpdatedAt(Instant.now());

        StaffMember saved = staffRepository.save(member);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<StaffPublicDto> getDirectory(StaffRole role) {
        List<StaffMember> members = (role != null)
                ? staffRepository.findByActiveTrueAndRoleOrderByFirstNameAscLastNameAsc(role)
                : staffRepository.findByActiveTrueOrderByFirstNameAscLastNameAsc();

        return members.stream()
                .map(m -> new StaffPublicDto(
                        m.getId(),
                        m.getFullName(),
                        Role.valueOf(m.getRole().name()),
                        m.getSpecialty()
                ))
                .sorted(Comparator.comparing(StaffPublicDto::fullName))
                .toList();
    }

    @Transactional(readOnly = true)
    public StaffPublicDto getPublicStaffById(UUID id) {
        StaffMember member = staffRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found or inactive"));

        return new StaffPublicDto(
                member.getId(),
                member.getFullName(),
                Role.valueOf(member.getRole().name()),
                member.getSpecialty()
        );
    }

    @Transactional(readOnly = true)
    public StaffMeDto getMe(Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        if (username == null || username.isBlank()) {
            username = jwt.getSubject();
        }

        List<Role> roles = extractSghRoles(jwt);

        StaffMeDto.MeStaffProfile staffProfile = null;
        String staffIdStr = jwt.getClaimAsString("staffId");
        if (staffIdStr != null && !staffIdStr.isBlank()) {
            try {
                UUID staffId = UUID.fromString(staffIdStr);
                Optional<StaffMember> memberOpt = staffRepository.findById(staffId);
                if (memberOpt.isPresent()) {
                    StaffMember m = memberOpt.get();
                    staffProfile = new StaffMeDto.MeStaffProfile(
                            m.getId(),
                            m.getFullName(),
                            Role.valueOf(m.getRole().name()),
                            m.getSpecialty(),
                            m.getDepartment()
                    );
                }
            } catch (IllegalArgumentException ignored) {
            }
        }

        UUID patientId = null;
        String patientIdStr = jwt.getClaimAsString("patientId");
        if (patientIdStr != null && !patientIdStr.isBlank()) {
            try {
                patientId = UUID.fromString(patientIdStr);
            } catch (IllegalArgumentException ignored) {
            }
        }

        return new StaffMeDto(username, roles, staffProfile, patientId);
    }

    @SuppressWarnings("unchecked")
    private List<Role> extractSghRoles(Jwt jwt) {
        Set<Role> roles = new LinkedHashSet<>();
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null && realmAccess.get("roles") instanceof List<?> roleList) {
            for (Object obj : roleList) {
                if (obj instanceof String roleStr) {
                    String upper = roleStr.toUpperCase();
                    if (SGH_ROLES.contains(upper)) {
                        roles.add(Role.valueOf(upper));
                    }
                }
            }
        }
        return new ArrayList<>(roles);
    }

    private StaffDto toDto(StaffMember m) {
        return new StaffDto(
                m.getId(),
                m.getKeycloakUserId(),
                m.getFirstName(),
                m.getLastName(),
                m.getRole(),
                m.getSpecialty(),
                m.getDepartment(),
                m.getEmail(),
                m.isActive(),
                m.getCreatedAt(),
                m.getUpdatedAt()
        );
    }
}
