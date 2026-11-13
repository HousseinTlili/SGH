package com.sgh.staff.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

@FeignClient(name = "patient-service", url = "${patient.service.url:http://localhost:8081}")
public interface PatientServiceClient {

    @GetMapping("/api/patients/{id}/summary")
    PatientSummaryDto getPatientSummary(@PathVariable("id") UUID id);
}
