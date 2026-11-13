package com.sgh.patient.service;

import com.sgh.patient.client.StaffClient;
import com.sgh.patient.client.StaffPublicResponse;
import com.sgh.patient.exception.ResourceNotFoundException;
import com.sgh.patient.model.dto.StaffLookupDto;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Looks up a staff member in Staff service through the OpenFeign {@link StaffClient}.
 * 404 from Staff stays a 404. Any other failure (connection refused, 2 s timeout, 5xx, 401/403)
 * gives the documented fallback: 200 with available=false and source=fallback.
 */
@Service
public class StaffLookupService {

    private static final Logger log = LoggerFactory.getLogger(StaffLookupService.class);

    private final StaffClient staffClient;

    public StaffLookupService(StaffClient staffClient) {
        this.staffClient = staffClient;
    }

    public StaffLookupDto lookup(UUID staffId) {
        try {
            StaffPublicResponse staff = staffClient.getPublicProfile(staffId);
            return new StaffLookupDto(staffId, true, staff.fullName(), staff.role(), staff.specialty(),
                    StaffLookupDto.SOURCE_STAFF);
        } catch (FeignException.NotFound e) {
            throw new ResourceNotFoundException("Staff member not found");
        } catch (FeignException e) {
            log.warn("Staff service call failed for {} (status {}): {}; using fallback",
                    staffId, e.status(), e.getMessage());
            return StaffLookupDto.fallback(staffId);
        }
    }
}
