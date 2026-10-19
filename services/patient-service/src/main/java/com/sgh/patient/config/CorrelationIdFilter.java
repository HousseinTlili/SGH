package com.sgh.patient.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter implements Filter {

    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (request instanceof HttpServletRequest httpRequest && response instanceof HttpServletResponse httpResponse) {
            String correlationId = httpRequest.getHeader(CORRELATION_ID_HEADER);
            if (correlationId == null || correlationId.trim().isEmpty()) {
                correlationId = UUID.randomUUID().toString().substring(0, 8);
            }

            httpRequest.setAttribute("correlationId", correlationId);
            httpResponse.setHeader(CORRELATION_ID_HEADER, correlationId);
            MDC.put("correlationId", correlationId);

            try {
                chain.doFilter(request, response);
            } finally {
                MDC.remove("correlationId");
            }
        } else {
            chain.doFilter(request, response);
        }
    }
}
