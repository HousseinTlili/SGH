package com.sgh.staff.model.dto;

import com.sgh.staff.model.StaffRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record StaffInputDto(
    @NotBlank(message = "firstName is required")
    @Size(min = 1, max = 80, message = "firstName must be between 1 and 80 characters")
    String firstName,

    @NotBlank(message = "lastName is required")
    @Size(min = 1, max = 80, message = "lastName must be between 1 and 80 characters")
    String lastName,

    @NotNull(message = "role is required")
    StaffRole role,

    @Size(max = 80, message = "specialty must be at most 80 characters")
    String specialty,

    @NotBlank(message = "department is required")
    @Size(min = 1, max = 80, message = "department must be between 1 and 80 characters")
    String department,

    @NotBlank(message = "email is required")
    @Email(message = "email must be a valid e-mail address")
    @Size(max = 120, message = "email must be at most 120 characters")
    String email,

    UUID keycloakUserId
) {}
