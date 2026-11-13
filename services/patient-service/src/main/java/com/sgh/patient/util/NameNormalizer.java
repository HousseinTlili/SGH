package com.sgh.patient.util;

import java.text.Normalizer;
import java.util.Locale;

/** Lowercase, collapse spaces and strip diacritics so "Béatrice" and "Beatrice" compare equal. */
public final class NameNormalizer {

    private NameNormalizer() {
    }

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String collapsed = raw.trim().replaceAll("\\s+", " ");
        String decomposed = Normalizer.normalize(collapsed, Normalizer.Form.NFD);
        String withoutMarks = decomposed.replaceAll("\\p{M}+", "");
        return withoutMarks.toLowerCase(Locale.ROOT);
    }
}
