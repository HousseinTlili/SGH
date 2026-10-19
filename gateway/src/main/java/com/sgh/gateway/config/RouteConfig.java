package com.sgh.gateway.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Builds the routes from the route table in {@link GatewayProperties}. */
@Configuration
public class RouteConfig {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder, GatewayProperties properties) {
        RouteLocatorBuilder.Builder routes = builder.routes();
        for (GatewayProperties.Route row : properties.routes()) {
            routes.route(row.id(), r -> r
                    .path(row.paths().toArray(String[]::new))
                    // the service name (not the route id) is what the 503 body and the status endpoint report
                    .metadata("service", row.service())
                    .uri(row.uri()));
        }
        return routes.build();
    }
}
