package com.sgh.patient.model.dto;

import com.sgh.patient.model.Gender;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

public class PatientInputDto {

    @NotBlank(message = "must not be blank")
    @Size(min = 1, max = 80, message = "must be between 1 and 80 characters")
    private String firstName;

    @NotBlank(message = "must not be blank")
    @Size(min = 1, max = 80, message = "must be between 1 and 80 characters")
    private String lastName;

    @NotNull(message = "must not be null")
    @Past(message = "must not be in the future")
    private LocalDate birthDate;

    @NotNull(message = "must not be null")
    private Gender gender;

    @Pattern(regexp = "^[+]?[0-9 ]{8,15}$", message = "invalid phone format")
    private String phone;

    @Email(message = "invalid email format")
    @Size(max = 120, message = "must not exceed 120 characters")
    private String email;

    @Size(max = 255, message = "must not exceed 255 characters")
    private String address;

    @Pattern(regexp = "^(A\\+|A-|B\\+|B-|AB\\+|AB-|O\\+|O-)$", message = "invalid blood type")
    private String bloodType;

    @Size(max = 500, message = "must not exceed 500 characters")
    private String allergies;

    @Size(max = 100, message = "must not exceed 100 characters")
    private String insuranceProvider;

    @Size(max = 50, message = "must not exceed 50 characters")
    private String insuranceNumber;

    public PatientInputDto() {
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

    public Gender getGender() {
        return gender;
    }

    public void setGender(Gender gender) {
        this.gender = gender;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getBloodType() {
        return bloodType;
    }

    public void setBloodType(String bloodType) {
        this.bloodType = bloodType;
    }

    public String getAllergies() {
        return allergies;
    }

    public void setAllergies(String allergies) {
        this.allergies = allergies;
    }

    public String getInsuranceProvider() {
        return insuranceProvider;
    }

    public void setInsuranceProvider(String insuranceProvider) {
        this.insuranceProvider = insuranceProvider;
    }

    public String getInsuranceNumber() {
        return insuranceNumber;
    }

    public void setInsuranceNumber(String insuranceNumber) {
        this.insuranceNumber = insuranceNumber;
    }
}
