package com.sgh.gateway.security;

import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationResult;
import org.springframework.security.authorization.ReactiveAuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.server.authorization.AuthorizationContext;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Set;

/** Applies {@link RoleRules}: a token without any allowed role for the prefix gets 403. */
@Component
public class RoleAuthorizationManager implements ReactiveAuthorizationManager<AuthorizationContext> {

    private final RoleRules rules;

    public RoleAuthorizationManager(RoleRules rules) {
        this.rules = rules;
    }

    @Override
    public Mono<AuthorizationResult> authorize(Mono<Authentication> authentication, AuthorizationContext context) {
        String path = context.getExchange().getRequest().getPath().value();
        return authentication
                .filter(Authentication::isAuthenticated)
                .<AuthorizationResult>map(auth -> new AuthorizationDecision(permits(auth, path)))
                .defaultIfEmpty(new AuthorizationDecision(false));
    }

    private boolean permits(Authentication authentication, String path) {
        // An unclaimed path is let through: no route will match it and the gateway answers 404.
        Set<String> allowed = rules.allowedRoles(path).orElse(Set.of());
        if (allowed.isEmpty()) {
            return true; // any authenticated user (the service stays authoritative)
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (allowed.contains(authority.getAuthority().replaceFirst("^ROLE_", ""))) {
                return true;
            }
        }
        return false;
    }
}
