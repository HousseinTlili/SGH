package com.sgh.gateway.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Roles come from {@code realm_access.roles}; only the seven SGH roles are kept (X-2). */
public class JwtRoleConverter implements Converter<Jwt, Mono<AbstractAuthenticationToken>> {

    @Override
    public Mono<AbstractAuthenticationToken> convert(Jwt jwt) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map<?, ?> map && map.get("roles") instanceof List<?> roles) {
            for (Object role : roles) {
                String name = String.valueOf(role).toUpperCase();
                if (RoleRules.SGH_ROLES.contains(name)) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_" + name));
                }
            }
        }
        String username = jwt.getClaimAsString("preferred_username");
        return Mono.just(new JwtAuthenticationToken(jwt, authorities, username != null ? username : jwt.getSubject()));
    }
}
