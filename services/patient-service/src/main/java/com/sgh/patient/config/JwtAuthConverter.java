package com.sgh.patient.config;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class JwtAuthConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private static final Set<String> ALLOWED_ROLES = Set.of(
            "ADMIN",
            "DOCTOR",
            "NURSE",
            "RECEPTIONIST",
            "PATIENT",
            "PHARMACIST",
            "LAB_TECH",
            "LAB_TECHNICIAN"
    );

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = extractResourceRoles(jwt);
        return new JwtAuthenticationToken(jwt, authorities, jwt.getClaimAsString("preferred_username"));
    }

    @SuppressWarnings("unchecked")
    private Collection<GrantedAuthority> extractResourceRoles(Jwt jwt) {
        Set<GrantedAuthority> authorities = new HashSet<>();

        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null && realmAccess.get("roles") instanceof List<?> roles) {
            for (Object roleObj : roles) {
                if (roleObj instanceof String role) {
                    String upperRole = role.toUpperCase();
                    if (ALLOWED_ROLES.contains(upperRole)) {
                        authorities.add(new SimpleGrantedAuthority("ROLE_" + upperRole));
                        if ("LAB_TECH".equals(upperRole)) {
                            authorities.add(new SimpleGrantedAuthority("ROLE_LAB_TECHNICIAN"));
                        } else if ("LAB_TECHNICIAN".equals(upperRole)) {
                            authorities.add(new SimpleGrantedAuthority("ROLE_LAB_TECH"));
                        }
                    }
                }
            }
        }

        return authorities;
    }
}
