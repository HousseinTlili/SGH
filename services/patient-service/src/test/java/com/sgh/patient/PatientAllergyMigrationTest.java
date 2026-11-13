package com.sgh.patient;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
class PatientAllergyMigrationTest {

    static {
        TestDatabase.ensure();
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Flyway V3 preserves every seeded legacy allergy as DECLARED")
    void seededLegacyAllergiesArePreserved() {
        Integer legacyCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM patients WHERE allergies IS NOT NULL AND TRIM(allergies) <> ''",
                Integer.class
        );
        Integer importedCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM patient_allergies WHERE recorded_by_username = 'flyway-v3'",
                Integer.class
        );
        Integer inferredClinicalFacts = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM patient_allergies
                WHERE recorded_by_username = 'flyway-v3'
                  AND (category IS NOT NULL OR observed_reaction IS NOT NULL OR reaction_severity IS NOT NULL)
                """,
                Integer.class
        );

        assertEquals(legacyCount, importedCount);
        assertEquals(0, inferredClinicalFacts);
    }
}
