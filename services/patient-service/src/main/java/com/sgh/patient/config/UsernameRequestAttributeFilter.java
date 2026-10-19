package com.sgh.patient.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Copies the authenticated username onto the request so the outermost filter can write it in the
 * request log line after Spring Security has cleared its context.
 */
public class UsernameRequestAttributeFilter extends OncePerRequestFilter {

    public static final String ATTRIBUTE = "sgh.username";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && authentication.getName() != null) {
            request.setAttribute(ATTRIBUTE, authentication.getName());
        }
        chain.doFilter(request, response);
    }
}
