package com.sgh.patient;

import com.sgh.patient.util.Levenshtein;
import com.sgh.patient.util.NameNormalizer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NameNormalizerTest {

    @Test
    @DisplayName("Normalisation: casse, espaces et accents")
    void normalizesCaseSpacesAndAccents() {
        assertEquals("beatrice", NameNormalizer.normalize("  Béatrice "));
        assertEquals("youssef ben salah", NameNormalizer.normalize("Youssef  BEN   salah"));
        assertEquals("", NameNormalizer.normalize("   "));
    }

    @Test
    @DisplayName("Distance de Levenshtein pour une faute d'orthographe")
    void levenshteinSpellingVariant() {
        assertEquals(0, Levenshtein.distance("trabelsi", "trabelsi"));
        assertEquals(1, Levenshtein.distance("trabelsi", "trabelsy"));
        assertEquals(1, Levenshtein.distance("youssef", "yousseff"));
    }
}
