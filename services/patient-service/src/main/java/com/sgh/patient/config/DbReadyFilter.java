package com.sgh.patient.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgh.patient.model.dto.ApiError;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class DbReadyFilter implements Filter {

    private final DbReadyService dbReadyService;
    private final ObjectMapper objectMapper;

    public DbReadyFilter(DbReadyService dbReadyService, ObjectMapper objectMapper) {
        this.dbReadyService = dbReadyService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (request instanceof HttpServletRequest httpRequest && response instanceof HttpServletResponse httpResponse) {
            String uri = httpRequest.getRequestURI();

            // Allow /health, /docs, /openapi.json, and actuator through unconditionally
            if (uri.startsWith("/api/") && !dbReadyService.isReady()) {
                httpResponse.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
                httpResponse.setContentType(MediaType.APPLICATION_JSON_VALUE);

                String correlationId = (String) httpRequest.getAttribute("correlationId");
                if (correlationId == null) {
                    correlationId = httpRequest.getHeader("X-Correlation-Id");
                }

                ApiError error = new ApiError(
                        HttpStatus.SERVICE_UNAVAILABLE.value(),
                        "Service Unavailable",
                        "Database unavailable",
                        uri,
                        correlationId != null ? correlationId : "unknown"
                );

                httpResponse.getWriter().write(objectMapper.writeValueAsString(error));
                return;
            }
        }

        chain.doFilter(request, response);
    }
}
