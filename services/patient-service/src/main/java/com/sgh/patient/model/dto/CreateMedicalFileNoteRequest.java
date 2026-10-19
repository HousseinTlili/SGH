package com.sgh.patient.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateMedicalFileNoteRequest {

    @NotBlank(message = "must not be blank")
    @Size(min = 1, max = 1000, message = "must not exceed 1000 characters")
    private String summary;

    public CreateMedicalFileNoteRequest() {
    }

    public CreateMedicalFileNoteRequest(String summary) {
        this.summary = summary;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }
}
