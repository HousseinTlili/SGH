package com.sgh.gateway.security;

import com.sgh.gateway.config.GatewayProperties;
import org.springframework.http.server.PathContainer;
import org.springframework.stereotype.Component;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** The coarse role rules of the route table: which realm roles may enter which path prefix. */
@Component
public class RoleRules {

    /** The seven roles of the realm; anything else in a token is ignored. */
    public static final Set<String> SGH_ROLES =
            Set.of("PATIENT", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "RECEPTIONIST", "ADMIN");

    private record Rule(PathPattern pattern, Set<String> roles) {
    }

    private final List<Rule> rules = new ArrayList<>();

    public RoleRules(GatewayProperties properties) {
        PathPatternParser parser = PathPatternParser.defaultInstance;
        for (GatewayProperties.Route route : properties.routes()) {
            for (String path : route.paths()) {
                rules.add(new Rule(parser.parse(path), Set.copyOf(route.roles())));
            }
        }
    }

    /**
     * The roles allowed on {@code path}: empty optional when no route claims the path (the gateway
     * answers 404 later), an empty set when any authenticated user may enter.
     */
    public Optional<Set<String>> allowedRoles(String path) {
        PathContainer container = PathContainer.parsePath(path);
        return rules.stream().filter(rule -> rule.pattern().matches(container)).findFirst().map(Rule::roles);
    }
}
