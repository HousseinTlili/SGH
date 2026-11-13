package com.sgh.patient;

import com.sgh.patient.model.Gender;
import com.sgh.patient.model.Patient;
import com.sgh.patient.util.FileCompleteness;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileCompletenessTest {

    private Patient base() {
        Patient p = new Patient(UUID.randomUUID(), "Amina", "Test", LocalDate.of(1990, 1, 1), Gender.FEMALE);
        p.setPhone("+21620111001");
        p.setEmail("amina@example.com");
        p.setAddress("Tunis");
        return p;
    }

    @Test
    @DisplayName("Missing phone, email or address marks the file incomplete")
    void missingContactIsIncomplete() {
        Patient missingPhone = base();
        missingPhone.setPhone(null);
        assertTrue(FileCompleteness.isIncomplete(missingPhone));

        Patient missingEmail = base();
        missingEmail.setEmail("  ");
        assertTrue(FileCompleteness.isIncomplete(missingEmail));

        Patient missingAddress = base();
        missingAddress.setAddress("");
        assertTrue(FileCompleteness.isIncomplete(missingAddress));

        assertFalse(FileCompleteness.isIncomplete(base()));
    }

    @Test
    @DisplayName("Insurance is required only when one of the two fields is filled")
    void insuranceOnlyWhenDeclared() {
        Patient uninsured = base();
        assertFalse(FileCompleteness.insuranceIncomplete(uninsured));
        assertFalse(FileCompleteness.isIncomplete(uninsured));

        Patient providerOnly = base();
        providerOnly.setInsuranceProvider("CNAM");
        assertTrue(FileCompleteness.insuranceIncomplete(providerOnly));
        assertTrue(FileCompleteness.isIncomplete(providerOnly));

        Patient completeInsurance = base();
        completeInsurance.setInsuranceProvider("CNAM");
        completeInsurance.setInsuranceNumber("10001");
        assertFalse(FileCompleteness.insuranceIncomplete(completeInsurance));
        assertFalse(FileCompleteness.isIncomplete(completeInsurance));
    }
}
