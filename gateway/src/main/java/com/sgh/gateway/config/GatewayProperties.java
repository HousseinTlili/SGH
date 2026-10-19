package com.sgh.gateway.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;

/**
 * The gateway's behaviour as data (application.yml, prefix {@code sgh.gateway}): adding a route or
 * changing a role rule is one entry in {@code routes}, no code.
 */
@Validated
@ConfigurationProperties(prefix = "sgh.gateway")
public record GatewayProperties(
        @NotBlank String keycloakIssuer,
        @NotBlank String keycloakJwksUri,
        @NotEmpty List<@Valid Route> routes,
        @Valid Cors cors,
        @Valid Status status) {

    /**
     * One row of the route table.
     *
     * @param id       route id
     * @param service  service name used in the 503 body and the status endpoint (patient, lab, ...)
     * @param uri      base URL of the service
     * @param paths    path patterns forwarded unchanged to the service
     * @param roles    realm roles allowed on these paths; empty means any authenticated user
     */
    public record Route(
            @NotBlank String id,
            @NotBlank String service,
            @NotBlank String uri,
            @NotEmpty List<@NotBlank String> paths,
            List<String> roles) {

        public Route {
            roles = roles == null ? List.of() : List.copyOf(roles);
        }
    }

    public record Cors(
            @NotEmpty List<String> allowedOrigins,
            @NotEmpty List<String> allowedMethods,
            @NotEmpty List<String> allowedHeaders,
            List<String> exposedHeaders) {
    }

    /** Aggregated status endpoint: per-service timeout and how long a result may be reused. */
    public record Status(Duration timeout, Duration cacheFor) {

        public Status {
            timeout = timeout == null ? Duration.ofSeconds(1) : timeout;
            cacheFor = cacheFor == null ? Duration.ofSeconds(2) : cacheFor;
        }
    }
}
