package com.sgh.gateway.web;

import com.sgh.gateway.config.GatewayProperties;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/** {@code /health} for the gateway itself and {@code /gateway/health/services} for the six services. Neither needs a token. */
@RestController
public class HealthController {

    private record Cached(Instant at, Map<String, Object> body) {
    }

    private final GatewayProperties properties;
    private final WebClient client = WebClient.create();
    private final AtomicReference<Cached> cache = new AtomicReference<>();

    public HealthController(GatewayProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }

    @GetMapping("/gateway/health/services")
    public Mono<Map<String, Object>> services() {
        Cached cached = cache.get();
        Duration ttl = properties.status().cacheFor();
        if (cached != null && Duration.between(cached.at(), Instant.now()).compareTo(ttl) < 0) {
            return Mono.just(cached.body());
        }

        // Every service is asked in parallel with its own timeout; a service is UP only when it answers 200.
        Flux<Map.Entry<String, String>> checks = Flux.fromIterable(properties.routes())
                .map(GatewayProperties.Route::service)
                .distinct()
                .flatMap(service -> probe(service).map(state -> Map.entry(service, state)));

        return checks.collectList().map(entries -> {
            Map<String, String> states = new LinkedHashMap<>();
            properties.routes().stream().map(GatewayProperties.Route::service).distinct()
                    .forEach(service -> states.put(service, entries.stream()
                            .filter(e -> e.getKey().equals(service)).map(Map.Entry::getValue).findFirst().orElse("DOWN")));
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("gateway", "UP");
            body.put("services", states);
            body.put("checkedAt", Instant.now().toString());
            cache.set(new Cached(Instant.now(), body));
            return body;
        });
    }

    private Mono<String> probe(String service) {
        String base = properties.routes().stream()
                .filter(route -> route.service().equals(service))
                .map(GatewayProperties.Route::uri)
                .findFirst()
                .orElseThrow();
        return client.get().uri(base + "/health")
                .exchangeToMono(response -> {
                    if (response.statusCode().equals(HttpStatus.OK)) {
                        return response.releaseBody().thenReturn("UP");
                    }
                    return response.releaseBody().thenReturn("DOWN");
                })
                .timeout(properties.status().timeout())
                .onErrorReturn("DOWN");
    }
}
