package com.sgh.patient.client;

import feign.RequestInterceptor;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Every outgoing Feign call forwards the caller's bearer token and the X-Correlation-Id
 * (CLAUDE.md conventions: service-to-service calls forward Authorization and X-Correlation-Id).
 * Feign runs on the request thread, so the security context and the MDC are available here.
 */
@Configuration
public class FeignForwardingConfig {

    @Bean
    public RequestInterceptor forwardAuthAndCorrelationId() {
        return template -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                template.header("Authorization", "Bearer " + jwtAuth.getToken().getTokenValue());
            }
            String correlationId = MDC.get("correlationId");
            if (correlationId != null) {
                template.header("X-Correlation-Id", correlationId);
            }
        };
    }
}
