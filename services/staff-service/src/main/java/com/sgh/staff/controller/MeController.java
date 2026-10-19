package com.sgh.staff.controller;

import com.sgh.staff.model.Role;
import com.sgh.staff.model.dto.StaffMeDto;
import com.sgh.staff.service.StaffService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api")
public class MeController {

    private static final List<String> ALL_ROLES = Arrays.stream(Role.values())
            .map(Enum::name)
            .toList();

    private final StaffService staffService;

    public MeController(StaffService staffService) {
        this.staffService = staffService;
    }

    @GetMapping("/me")
    public ResponseEntity<StaffMeDto> getMe(@AuthenticationPrincipal Jwt jwt) {
        StaffMeDto me = staffService.getMe(jwt);
        return ResponseEntity.ok(me);
    }

    @GetMapping("/roles")
    public ResponseEntity<List<String>> getRoles() {
        return ResponseEntity.ok(ALL_ROLES);
    }
}
