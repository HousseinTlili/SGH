package com.sgh.gateway.web;

import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/** Runs after authentication and puts the username on the exchange for the access log line. */
public class UsernameWebFilter implements WebFilter {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        return ReactiveSecurityContextHolder.getContext()
                .map(context -> context.getAuthentication())
                .filter(authentication -> authentication != null && authentication.isAuthenticated())
                .doOnNext(authentication -> exchange.getAttributes().put(CorrelationIdWebFilter.USER_ATTRIBUTE, authentication.getName()))
                .then(Mono.defer(() -> chain.filter(exchange)));
    }
}
