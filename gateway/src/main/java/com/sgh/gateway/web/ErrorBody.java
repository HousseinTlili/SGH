package com.sgh.gateway.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Writes the shared error body (API Contracts) from the gateway, with an optional {@code service}. */
public final class ErrorBody {

    private static final ObjectMapper MAPPER = JsonMapper.builder().build();

    private ErrorBody() {
    }

    public static Mono<Void> write(ServerWebExchange exchange, HttpStatus status, String message, String service) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        if (service != null) {
            body.put("service", service);
        }
        body.put("message", message);
        body.put("path", exchange.getRequest().getPath().value());
        body.put("correlationId", CorrelationIdWebFilter.of(exchange));

        ServerHttpResponse response = exchange.getResponse();
        if (response.isCommitted()) {
            return Mono.empty();
        }
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] bytes = MAPPER.writeValueAsString(body).getBytes(StandardCharsets.UTF_8);
        return response.writeWith(Mono.just(response.bufferFactory().wrap(bytes)));
    }
}
