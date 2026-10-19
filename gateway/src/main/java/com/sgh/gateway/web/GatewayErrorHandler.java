package com.sgh.gateway.web;

import io.netty.channel.ConnectTimeoutException;
import io.netty.handler.timeout.ReadTimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebExceptionHandler;
import reactor.core.publisher.Mono;

import java.net.ConnectException;
import java.net.UnknownHostException;
import java.nio.channels.ClosedChannelException;
import java.util.Map;
import java.util.concurrent.TimeoutException;

/**
 * Turns failures into the shared error body. A service that cannot be reached (connection refused,
 * DNS failure, timeout) becomes a 503 naming the service; anything a service itself answers,
 * 4xx or 5xx, never reaches this handler and is passed through untouched.
 */
@Component
@Order(-2) // ahead of Spring Boot's default error handler
public class GatewayErrorHandler implements WebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GatewayErrorHandler.class);

    private static final Map<String, String> DISPLAY = Map.of(
            "patient", "Patient",
            "reception", "Reception",
            "consultation", "Consultation",
            "lab", "Lab",
            "pharmacy", "Pharmacy",
            "staff", "Staff");

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        if (exchange.getResponse().isCommitted()) {
            return Mono.error(ex);
        }

        Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
        if (route != null && isServiceUnreachable(ex)) {
            String service = route.getMetadata().containsKey("service")
                    ? String.valueOf(route.getMetadata().get("service"))
                    : route.getId();
            log.warn("{} service unreachable on {}: {}", service, exchange.getRequest().getPath().value(), rootCause(ex));
            String name = DISPLAY.getOrDefault(service, service);
            return ErrorBody.write(exchange, HttpStatus.SERVICE_UNAVAILABLE,
                    name + " service is unavailable, please try again later", service);
        }

        if (ex instanceof ResponseStatusException statusException) {
            HttpStatusCode code = statusException.getStatusCode();
            HttpStatus status = HttpStatus.resolve(code.value());
            if (status != null && status.is4xxClientError()) {
                String message = status == HttpStatus.NOT_FOUND
                        ? "No route for " + exchange.getRequest().getMethod() + " " + exchange.getRequest().getPath().value()
                        : String.valueOf(statusException.getReason() != null ? statusException.getReason() : status.getReasonPhrase());
                return ErrorBody.write(exchange, status, message, null);
            }
        }

        log.error("Unhandled gateway error on {}", exchange.getRequest().getPath().value(), ex);
        return ErrorBody.write(exchange, HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", null);
    }

    private static boolean isServiceUnreachable(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof ConnectException || t instanceof UnknownHostException || t instanceof TimeoutException
                    || t instanceof ConnectTimeoutException || t instanceof ReadTimeoutException
                    || t instanceof ClosedChannelException
                    || t instanceof org.springframework.cloud.gateway.support.NotFoundException
                    || t instanceof org.springframework.cloud.gateway.support.TimeoutException) {
                return true;
            }
            if (t instanceof ResponseStatusException rse
                    && (rse.getStatusCode().value() == 503 || rse.getStatusCode().value() == 504)) {
                return true;
            }
        }
        return false;
    }

    private static String rootCause(Throwable ex) {
        Throwable t = ex;
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
        }
        return t.getClass().getSimpleName();
    }
}
