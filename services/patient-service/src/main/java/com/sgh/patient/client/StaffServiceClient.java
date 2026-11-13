package com.sgh.patient.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

@FeignClient(name = "staff-service", url = "${staff.service.url:http://localhost:8086}")
public interface StaffServiceClient {

    @GetMapping("/api/staff/{id}/public")
    StaffPublicDto getStaffPublic(@PathVariable("id") UUID id);
}
