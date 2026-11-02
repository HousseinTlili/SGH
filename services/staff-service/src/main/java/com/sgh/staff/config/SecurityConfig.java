package com.sgh.staff.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgh.staff.model.dto.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthConverter jwtAuthConverter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthConverter jwtAuthConverter, ObjectMapper objectMapper) {
        this.jwtAuthConverter = jwtAuthConverter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/health").permitAll()
                        .requestMatchers("/docs", "/docs/**", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/openapi.json").permitAll()


                        // Directory: must come before /api/staff/*
                        .requestMatchers(HttpMethod.GET, "/api/staff/directory").hasAnyRole("RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ADMIN")

                        // Specific staff sub-endpoints before /api/staff/*
                        .requestMatchers(HttpMethod.GET, "/api/staff/*/public").hasAnyRole("PATIENT", "RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/staff/*/deactivate").hasRole("ADMIN")

                        // Single staff member endpoints
                        .requestMatchers(HttpMethod.GET, "/api/staff/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/staff/*").hasRole("ADMIN")

                        // Staff collection endpoints
                        .requestMatchers(HttpMethod.GET, "/api/staff").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/staff").hasRole("ADMIN")

                        // Roles and Me endpoints
                        .requestMatchers(HttpMethod.GET, "/api/roles").hasAnyRole("PATIENT", "RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/me").hasAnyRole("PATIENT", "RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ADMIN")

                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter))
                        .authenticationEntryPoint(customAuthenticationEntryPoint())
                        .accessDeniedHandler(customAccessDeniedHandler())
                )
                .addFilterAfter(new UsernameRequestAttributeFilter(), BearerTokenAuthenticationFilter.class)
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(customAuthenticationEntryPoint())
                        .accessDeniedHandler(customAccessDeniedHandler())
                );

        return http.build();
    }

    private String getCorrelationId(HttpServletRequest request) {
        String correlationId = (String) request.getAttribute("correlationId");
        if (correlationId == null) {
            correlationId = request.getHeader("X-Correlation-Id");
        }
        return correlationId != null ? correlationId : "unknown";
    }

    @Bean
    public AuthenticationEntryPoint customAuthenticationEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiError error = new ApiError(
                    HttpStatus.UNAUTHORIZED.value(),
                    "Unauthorized",
                    "Missing or invalid token",
                    request.getRequestURI(),
                    getCorrelationId(request)
            );
            response.getWriter().write(objectMapper.writeValueAsString(error));
        };
    }

    @Bean
    public AccessDeniedHandler customAccessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiError error = new ApiError(
                    HttpStatus.FORBIDDEN.value(),
                    "Forbidden",
                    "Your role is not allowed to do this",
                    request.getRequestURI(),
                    getCorrelationId(request)
            );
            response.getWriter().write(objectMapper.writeValueAsString(error));
        };
    }
}
