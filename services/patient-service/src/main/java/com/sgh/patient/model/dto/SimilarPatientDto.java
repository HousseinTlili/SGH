package com.sgh.patient.model.dto;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Restricted view for the similar-patient hint. No contact, insurance or clinical fields.
 */
public class SimilarPatientDto {

    public static final String MATCH_EXACT = "EXACT";
    public static final String MATCH_SIMILAR = "SIMILAR";

    private UUID id;
    private String firstName;
    private String lastName;
    private LocalDate birthDate;
    private String match;
    private int score;

    public SimilarPatientDto() {
    }

    public SimilarPatientDto(UUID id, String firstName, String lastName, LocalDate birthDate, String match, int score) {
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.birthDate = birthDate;
        this.match = match;
        this.score = score;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }

    public String getMatch() {
        return match;
    }

    public void setMatch(String match) {
        this.match = match;
    }

    public int getScore() {
        return score;
    }

    public void setScore(int score) {
        this.score = score;
    }
}
