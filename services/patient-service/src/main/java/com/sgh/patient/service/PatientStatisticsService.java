package com.sgh.patient.service;

import com.sgh.patient.exception.UnprocessableException;
import com.sgh.patient.model.Gender;
import com.sgh.patient.model.Patient;
import com.sgh.patient.model.dto.PatientStatisticsDto;
import com.sgh.patient.model.dto.PatientStatisticsDto.CompletenessDto;
import com.sgh.patient.model.dto.PatientStatisticsDto.MonthCountDto;
import com.sgh.patient.model.dto.PatientStatisticsDto.NamedCountDto;
import com.sgh.patient.model.dto.PatientStatisticsDto.PeriodDto;
import com.sgh.patient.repository.PatientRepository;
import com.sgh.patient.util.FileCompleteness;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class PatientStatisticsService {

    private static final Set<String> PERIODS = Set.of("THIS_MONTH", "LAST_3_MONTHS", "LAST_12_MONTHS", "CUSTOM");
    private static final Set<String> AGE_GROUPS = Set.of("ALL", "0-17", "18-35", "36-60", "60+");
    private static final List<String> AGE_GROUP_ORDER = List.of("0-17", "18-35", "36-60", "60+");

    private final PatientRepository patientRepository;

    public PatientStatisticsService(PatientRepository patientRepository) {
        this.patientRepository = patientRepository;
    }

    public PatientStatisticsDto statistics(String period, String fromRaw, String toRaw, String ageGroup, String genderRaw) {
        String preset = period == null || period.isBlank() ? "LAST_12_MONTHS" : period.trim();
        String ageFilter = ageGroup == null || ageGroup.isBlank() ? "ALL" : ageGroup.trim();
        String genderFilter = genderRaw == null || genderRaw.isBlank() ? "ALL" : genderRaw.trim();

        if (!PERIODS.contains(preset)) {
            throw new UnprocessableException("Validation failed", "period", "must be THIS_MONTH, LAST_3_MONTHS, LAST_12_MONTHS or CUSTOM");
        }
        if (!AGE_GROUPS.contains(ageFilter)) {
            throw new UnprocessableException("Validation failed", "ageGroup", "must be ALL, 0-17, 18-35, 36-60 or 60+");
        }
        Gender gender = parseGender(genderFilter);
        LocalDateRange range = resolvePeriod(preset, fromRaw, toRaw);

        List<Patient> active = patientRepository.findByDeletedFalse();
        List<Patient> population = active.stream()
                .filter(p -> matchesGender(p, gender))
                .filter(p -> matchesAgeGroup(p, ageFilter))
                .toList();

        Instant fromInclusive = range.from.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant toExclusive = range.to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        long newRegistrations = population.stream()
                .filter(p -> p.getCreatedAt() != null)
                .filter(p -> !p.getCreatedAt().isBefore(fromInclusive) && p.getCreatedAt().isBefore(toExclusive))
                .count();

        long incomplete = population.stream().filter(FileCompleteness::isIncomplete).count();

        PatientStatisticsDto dto = new PatientStatisticsDto();
        dto.setPeriod(new PeriodDto(range.from, range.to, preset));
        dto.setActivePatients(population.size());
        dto.setNewRegistrations(newRegistrations);
        dto.setAverageAge(averageAge(population));
        dto.setIncompleteFiles(incomplete);
        dto.setRegistrationsByMonth(registrationsByMonth(population, range.from, range.to, fromInclusive, toExclusive));
        dto.setAgeGroups(ageGroupCounts(population));
        dto.setGenders(genderCounts(population));
        dto.setCompleteness(new CompletenessDto(population.size() - incomplete, incomplete));
        return dto;
    }

    private static Gender parseGender(String genderFilter) {
        if ("ALL".equals(genderFilter)) {
            return null;
        }
        try {
            return Gender.valueOf(genderFilter);
        } catch (IllegalArgumentException ex) {
            throw new UnprocessableException("Validation failed", "gender", "must be ALL, MALE, FEMALE or OTHER");
        }
    }

    private static LocalDateRange resolvePeriod(String preset, String fromRaw, String toRaw) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return switch (preset) {
            case "THIS_MONTH" -> new LocalDateRange(today.withDayOfMonth(1), today);
            case "LAST_3_MONTHS" -> new LocalDateRange(today.minusMonths(3), today);
            case "LAST_12_MONTHS" -> new LocalDateRange(today.minusMonths(12), today);
            case "CUSTOM" -> {
                if (fromRaw == null || fromRaw.isBlank() || toRaw == null || toRaw.isBlank()) {
                    throw new UnprocessableException("Validation failed", "from", "CUSTOM period requires from and to (YYYY-MM-DD)");
                }
                LocalDate from = parseDate("from", fromRaw);
                LocalDate to = parseDate("to", toRaw);
                if (from.isAfter(to)) {
                    throw new UnprocessableException("Validation failed", "from", "must not be after to");
                }
                yield new LocalDateRange(from, to);
            }
            default -> throw new UnprocessableException("Validation failed", "period", "unknown period");
        };
    }

    private static LocalDate parseDate(String field, String raw) {
        try {
            return LocalDate.parse(raw);
        } catch (DateTimeParseException ex) {
            throw new UnprocessableException("Validation failed", field, "must be a date YYYY-MM-DD");
        }
    }

    private static boolean matchesGender(Patient patient, Gender gender) {
        return gender == null || patient.getGender() == gender;
    }

    private static boolean matchesAgeGroup(Patient patient, String ageGroup) {
        if ("ALL".equals(ageGroup)) {
            return true;
        }
        return ageGroupLabel(ageYears(patient.getBirthDate())).equals(ageGroup);
    }

    static int ageYears(LocalDate birthDate) {
        return Period.between(birthDate, LocalDate.now(ZoneOffset.UTC)).getYears();
    }

    static String ageGroupLabel(int years) {
        if (years < 18) {
            return "0-17";
        }
        if (years <= 35) {
            return "18-35";
        }
        if (years <= 60) {
            return "36-60";
        }
        return "60+";
    }

    private static Double averageAge(List<Patient> patients) {
        if (patients.isEmpty()) {
            return null;
        }
        double sum = patients.stream().mapToInt(p -> ageYears(p.getBirthDate())).sum();
        return BigDecimal.valueOf(sum / patients.size()).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private static List<MonthCountDto> registrationsByMonth(
            List<Patient> population,
            LocalDate from,
            LocalDate to,
            Instant fromInclusive,
            Instant toExclusive
    ) {
        Map<String, Long> counts = new LinkedHashMap<>();
        YearMonth cursor = YearMonth.from(from);
        YearMonth last = YearMonth.from(to);
        while (!cursor.isAfter(last)) {
            counts.put(cursor.toString(), 0L);
            cursor = cursor.plusMonths(1);
        }
        for (Patient patient : population) {
            Instant created = patient.getCreatedAt();
            if (created == null || created.isBefore(fromInclusive) || !created.isBefore(toExclusive)) {
                continue;
            }
            String month = YearMonth.from(created.atZone(ZoneOffset.UTC)).toString();
            counts.computeIfPresent(month, (key, value) -> value + 1);
        }
        List<MonthCountDto> result = new ArrayList<>();
        counts.forEach((month, count) -> result.add(new MonthCountDto(month, count)));
        return result;
    }

    private static List<NamedCountDto> ageGroupCounts(List<Patient> population) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String group : AGE_GROUP_ORDER) {
            counts.put(group, 0L);
        }
        for (Patient patient : population) {
            String label = ageGroupLabel(ageYears(patient.getBirthDate()));
            counts.computeIfPresent(label, (key, value) -> value + 1);
        }
        List<NamedCountDto> result = new ArrayList<>();
        counts.forEach((name, count) -> result.add(new NamedCountDto(name, count)));
        return result;
    }

    private static List<NamedCountDto> genderCounts(List<Patient> population) {
        Map<Gender, Long> counts = new EnumMap<>(Gender.class);
        for (Gender gender : Gender.values()) {
            counts.put(gender, 0L);
        }
        for (Patient patient : population) {
            counts.computeIfPresent(patient.getGender(), (key, value) -> value + 1);
        }
        List<NamedCountDto> result = new ArrayList<>();
        for (Gender gender : Gender.values()) {
            result.add(new NamedCountDto(gender.name(), counts.get(gender)));
        }
        return result;
    }

    private record LocalDateRange(LocalDate from, LocalDate to) {
    }
}
