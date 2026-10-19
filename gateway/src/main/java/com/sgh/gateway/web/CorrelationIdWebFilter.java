package com.sgh.gateway.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * X-Correlation-Id: read from the request or create an 8-character id, forward it to the service,
 * return it in the response, and write one log line per request (method, path, status, duration,
 * correlation id, user; never the token). Runs before Spring Security so even a 401 carries the id.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdWebFilter implements WebFilter {

    public static final String HEADER = "X-Correlation-Id";
    public static final String ATTRIBUTE = "sgh.correlationId";
    public static final String USER_ATTRIBUTE = "sgh.username";

    private static final Logger log = LoggerFactory.getLogger("gateway.access");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String incoming = exchange.getRequest().getHeaders().getFirst(HEADER);
        String correlationId = incoming == null || incoming.isBlank()
                ? UUID.randomUUID().toString().substring(0, 8)
                : incoming.trim();

        ServerWebExchange mutated = exchange.mutate()
                .request(request -> request.headers(headers -> headers.set(HEADER, correlationId)))
                .build();
        mutated.getAttributes().put(ATTRIBUTE, correlationId);
        mutated.getResponse().beforeCommit(() -> {
            mutated.getResponse().getHeaders().set(HEADER, correlationId);
            return Mono.empty();
        });

        long started = System.nanoTime();
        return chain.filter(mutated).doFinally(signal -> {
            Object user = mutated.getAttributes().get(USER_ATTRIBUTE);
            log.info("{} {} -> {} in {} ms correlationId={} user={}",
                    mutated.getRequest().getMethod(),
                    mutated.getRequest().getPath().value(),
                    mutated.getResponse().getStatusCode() == null ? "?" : mutated.getResponse().getStatusCode().value(),
                    (System.nanoTime() - started) / 1_000_000,
                    correlationId,
                    user != null ? user : "anonymous");
        });
    }

    public static String of(ServerWebExchange exchange) {
        Object value = exchange.getAttributes().get(ATTRIBUTE);
        return value != null ? value.toString() : "unknown";
    }
}
