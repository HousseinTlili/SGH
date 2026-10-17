import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

export interface PatientSummary {
  fullName: string;
  birthDate: string;
}

export type PatientLookupResult =
  | { success: true; snapshot: PatientSummary }
  | { notFound: true }
  | { failed: true; snapshot: null };

export async function fetchPatientSummary(
  patientId: string,
  token?: string,
  correlationId?: string
): Promise<PatientLookupResult> {
  const url = `${config.patientServiceUrl}/api/patients/${patientId}/summary`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.httpTimeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json"
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (correlationId) {
      headers["X-Correlation-Id"] = correlationId;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    clearTimeout(timer);

    if (response.status === 200) {
      const data = (await response.json()) as PatientSummary;
      return { success: true, snapshot: data };
    }

    if (response.status === 404) {
      return { notFound: true };
    }

    logger.warn(
      { status: response.status, patientId },
      "Patient service returned non-200/404, falling back to null snapshot"
    );
    return { failed: true, snapshot: null };
  } catch (err) {
    clearTimeout(timer);
    logger.warn(
      { err, patientId },
      "Failed to reach Patient service (timeout or down), falling back to null snapshot (CON-2)"
    );
    return { failed: true, snapshot: null };
  }
}
