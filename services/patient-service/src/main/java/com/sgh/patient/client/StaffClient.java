package com.sgh.patient.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

/**
 * OpenFeign client for Staff service (port 8086). Static URL, no service discovery.
 * Timeouts (2 s) live in application.properties; Authorization and X-Correlation-Id are added by
 * {@link FeignForwardingConfig}. Callers handle errors and the fallback (see StaffLookupService).
 */
@FeignClient(name = "staff-service", url = "${staff-service.url}")
public interface StaffClient {

    @GetMapping("/api/staff/{id}/public")
    StaffPublicResponse getPublicProfile(@PathVariable("id") UUID id);
}
