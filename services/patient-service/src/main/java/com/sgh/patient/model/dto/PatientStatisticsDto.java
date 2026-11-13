package com.sgh.patient.model.dto;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class PatientStatisticsDto {

    private PeriodDto period;
    private long activePatients;
    private long newRegistrations;
    private Double averageAge;
    private long incompleteFiles;
    private List<MonthCountDto> registrationsByMonth = new ArrayList<>();
    private List<NamedCountDto> ageGroups = new ArrayList<>();
    private List<NamedCountDto> genders = new ArrayList<>();
    private CompletenessDto completeness = new CompletenessDto();

    public PeriodDto getPeriod() {
        return period;
    }

    public void setPeriod(PeriodDto period) {
        this.period = period;
    }

    public long getActivePatients() {
        return activePatients;
    }

    public void setActivePatients(long activePatients) {
        this.activePatients = activePatients;
    }

    public long getNewRegistrations() {
        return newRegistrations;
    }

    public void setNewRegistrations(long newRegistrations) {
        this.newRegistrations = newRegistrations;
    }

    public Double getAverageAge() {
        return averageAge;
    }

    public void setAverageAge(Double averageAge) {
        this.averageAge = averageAge;
    }

    public long getIncompleteFiles() {
        return incompleteFiles;
    }

    public void setIncompleteFiles(long incompleteFiles) {
        this.incompleteFiles = incompleteFiles;
    }

    public List<MonthCountDto> getRegistrationsByMonth() {
        return registrationsByMonth;
    }

    public void setRegistrationsByMonth(List<MonthCountDto> registrationsByMonth) {
        this.registrationsByMonth = registrationsByMonth;
    }

    public List<NamedCountDto> getAgeGroups() {
        return ageGroups;
    }

    public void setAgeGroups(List<NamedCountDto> ageGroups) {
        this.ageGroups = ageGroups;
    }

    public List<NamedCountDto> getGenders() {
        return genders;
    }

    public void setGenders(List<NamedCountDto> genders) {
        this.genders = genders;
    }

    public CompletenessDto getCompleteness() {
        return completeness;
    }

    public void setCompleteness(CompletenessDto completeness) {
        this.completeness = completeness;
    }

    public static class PeriodDto {
        private LocalDate from;
        private LocalDate to;
        private String preset;

        public PeriodDto() {
        }

        public PeriodDto(LocalDate from, LocalDate to, String preset) {
            this.from = from;
            this.to = to;
            this.preset = preset;
        }

        public LocalDate getFrom() {
            return from;
        }

        public void setFrom(LocalDate from) {
            this.from = from;
        }

        public LocalDate getTo() {
            return to;
        }

        public void setTo(LocalDate to) {
            this.to = to;
        }

        public String getPreset() {
            return preset;
        }

        public void setPreset(String preset) {
            this.preset = preset;
        }
    }

    public static class MonthCountDto {
        private String month;
        private long count;

        public MonthCountDto() {
        }

        public MonthCountDto(String month, long count) {
            this.month = month;
            this.count = count;
        }

        public String getMonth() {
            return month;
        }

        public void setMonth(String month) {
            this.month = month;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }
    }

    public static class NamedCountDto {
        private String name;
        private long count;

        public NamedCountDto() {
        }

        public NamedCountDto(String name, long count) {
            this.name = name;
            this.count = count;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }
    }

    public static class CompletenessDto {
        private long complete;
        private long incomplete;

        public CompletenessDto() {
        }

        public CompletenessDto(long complete, long incomplete) {
            this.complete = complete;
            this.incomplete = incomplete;
        }

        public long getComplete() {
            return complete;
        }

        public void setComplete(long complete) {
            this.complete = complete;
        }

        public long getIncomplete() {
            return incomplete;
        }

        public void setIncomplete(long incomplete) {
            this.incomplete = incomplete;
        }
    }
}
