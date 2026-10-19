package com.sgh.gateway.config;

import com.sgh.gateway.security.JwtRoleConverter;
import com.sgh.gateway.security.RoleAuthorizationManager;
import com.sgh.gateway.web.ErrorBody;
import com.sgh.gateway.web.UsernameWebFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.SecurityWebFiltersOrder;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import org.springframework.security.web.server.authorization.ServerAccessDeniedHandler;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import reactor.core.publisher.Mono;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SecurityConfig.class);

    /**
     * Signature through the realm's public keys, issuer and expiry; no audience is required.
     * The keys are fetched lazily and cached, so the gateway starts and serves /health with
     * Keycloak down (X-6), and tokens already issued keep working while Keycloak is stopped.
     */
    @Bean
    public ReactiveJwtDecoder jwtDecoder(GatewayProperties properties) {
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withJwkSetUri(properties.keycloakJwksUri()).build();
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(properties.keycloakIssuer()));
        decoder.setJwtValidator(validator);
        // When Keycloak cannot be reached the keys cannot be fetched and the library throws a plain
        // IllegalStateException; that must end as a refused token (401, like the services), never as a 500.
        // BadJwtException is the kind of failure Spring Security turns into a 401.
        return token -> Mono.defer(() -> decoder.decode(token)).onErrorMap(
                error -> !(error instanceof JwtException),
                error -> {
                    log.warn("Token could not be verified: {}", error.getMessage());
                    return new BadJwtException("Token could not be verified", error);
                });
    }

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(
            ServerHttpSecurity http,
            ReactiveJwtDecoder jwtDecoder,
            RoleAuthorizationManager roleManager,
            CorsConfigurationSource corsConfigurationSource) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .logout(ServerHttpSecurity.LogoutSpec::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .authorizeExchange(exchange -> exchange
                        .pathMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .pathMatchers("/health", "/gateway/health/**").permitAll()
                        .pathMatchers("/api/**").access(roleManager)
                        .anyExchange().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtDecoder(jwtDecoder).jwtAuthenticationConverter(new JwtRoleConverter()))
                        .authenticationEntryPoint(entryPoint())
                        .accessDeniedHandler(accessDeniedHandler()))
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(entryPoint())
                        .accessDeniedHandler(accessDeniedHandler()))
                .addFilterAfter(new UsernameWebFilter(), SecurityWebFiltersOrder.AUTHENTICATION)
                .build();
    }

    // The reason a token failed is never returned: one message for every 401.
    private ServerAuthenticationEntryPoint entryPoint() {
        return (exchange, error) -> ErrorBody.write(exchange, HttpStatus.UNAUTHORIZED, "Missing or invalid token", null);
    }

    private ServerAccessDeniedHandler accessDeniedHandler() {
        return (exchange, denied) -> ErrorBody.write(exchange, HttpStatus.FORBIDDEN, "Your role is not allowed to do this", null);
    }
}
