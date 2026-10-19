package com.sgh.gateway;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Stand-ins for the six services and for Keycloak's key endpoint, so the gateway is tested over real HTTP:
 * a stub can be stopped (connection refused), hang (timeout) or answer a fixed status.
 */
final class TestStack {

    static final String ISSUER = "http://localhost:8180/realms/sgh";
    static final List<String> SERVICE_NAMES = List.of("patient", "reception", "consultation", "lab", "pharmacy", "staff");

    /** One stub service. */
    static final class Stub {
        final String name;
        private HttpServer server;
        private int port;
        /** 0 = answer normally, otherwise answer this status with a JSON body. */
        final AtomicInteger forcedStatus = new AtomicInteger(0);
        /** When true the stub accepts the request and never answers. */
        volatile boolean hang;
        final AtomicReference<Map<String, String>> lastHeaders = new AtomicReference<>(Map.of());
        final AtomicReference<String> lastPath = new AtomicReference<>();

        Stub(String name) {
            this.name = name;
        }

        void start() {
            try {
                server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
                server.createContext("/", exchange -> {
                    String path = exchange.getRequestURI().getRawPath();
                    if (path.equals("/health")) {
                        write(exchange, 200, "{\"status\":\"UP\"}");
                        return;
                    }
                    Map<String, String> headers = new ConcurrentHashMap<>();
                    exchange.getRequestHeaders().forEach((k, v) -> headers.put(k.toLowerCase(), v.get(0)));
                    lastHeaders.set(headers);
                    lastPath.set(path);
                    if (hang) {
                        return;
                    }
                    int forced = forcedStatus.get();
                    if (forced != 0) {
                        write(exchange, forced, "{\"status\":" + forced + ",\"from\":\"" + name + "\",\"message\":\"as the service said\"}");
                        return;
                    }
                    write(exchange, 200, "{\"service\":\"" + name + "\",\"path\":\"" + path + "\"}");
                });
                server.start();
                port = server.getAddress().getPort();
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
        }

        void stop() {
            if (server != null) {
                server.stop(0);
                server = null;
            }
        }

        String url() {
            return "http://127.0.0.1:" + port;
        }

        private static void write(com.sun.net.httpserver.HttpExchange exchange, int status, String body) throws IOException {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        }
    }

    static final Map<String, Stub> STUBS = new ConcurrentHashMap<>();
    static final RSAKey KEY;
    static final RSAKey OTHER_KEY;
    private static final HttpServer JWKS;

    static {
        try {
            KEY = new RSAKeyGenerator(2048).keyID("test-key").generate();
            OTHER_KEY = new RSAKeyGenerator(2048).keyID("test-key").generate(); // same kid, different key
            JWKS = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            JWKS.createContext("/certs", exchange -> {
                byte[] body = new JWKSet(KEY.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            JWKS.start();
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);
        }
        for (String name : SERVICE_NAMES) {
            Stub stub = new Stub(name);
            stub.start();
            STUBS.put(name, stub);
        }
    }

    private TestStack() {
    }

    static String jwksUri() {
        return "http://127.0.0.1:" + JWKS.getAddress().getPort() + "/certs";
    }

    static Stub stub(String name) {
        return STUBS.get(name);
    }

    static void resetStubs() {
        for (Stub stub : STUBS.values()) {
            stub.forcedStatus.set(0);
            stub.hang = false;
            stub.lastHeaders.set(Map.of());
            stub.lastPath.set(null);
            if (stub.server == null) {
                stub.start();
            }
        }
    }

    /** A token as Keycloak would issue it for one of the seeded users. */
    static String token(String username, String... roles) {
        return sign(KEY, ISSUER, 3600, username, roles);
    }

    static String sign(RSAKey key, String issuer, long expiresInSeconds, String username, String... roles) {
        try {
            Instant now = Instant.now();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .issuer(issuer)
                    .subject(username)
                    .claim("preferred_username", username)
                    .claim("realm_access", Map.of("roles", List.of(roles)))
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plusSeconds(expiresInSeconds)))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).type(JOSEObjectType.JWT).build(), claims);
            jwt.sign(new RSASSASigner(key));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
