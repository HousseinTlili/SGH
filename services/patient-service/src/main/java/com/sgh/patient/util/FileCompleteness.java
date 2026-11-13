package com.sgh.patient.util;

import com.sgh.patient.model.Patient;

/**
 * Administrative completeness of a patient file.
 * Phone, email and address are always required for a complete file.
 * There is no {@code insured} flag on the current model: a patient is treated as
 * declared insured only when at least one of {@code insuranceProvider} or
 * {@code insuranceNumber} is filled. In that case both fields must be present.
 * Both empty means uninsured / unknown and does not count as incomplete.
 */
public final class FileCompleteness {

    private FileCompleteness() {
    }

    public static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public static boolean insuranceIncomplete(Patient patient) {
        boolean hasProvider = !isBlank(patient.getInsuranceProvider());
        boolean hasNumber = !isBlank(patient.getInsuranceNumber());
        return hasProvider ^ hasNumber;
    }

    public static boolean isIncomplete(Patient patient) {
        return isBlank(patient.getPhone())
                || isBlank(patient.getEmail())
                || isBlank(patient.getAddress())
                || insuranceIncomplete(patient);
    }
}
