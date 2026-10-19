import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

export type PatientCheckResult =
  | { status: "FOUND" }
  | { status: "NOT_FOUND" }
  | { status: "UNAVAILABLE" };

export async function checkPatientSummary(
  patientId: string,
  token?: string,
  correlationId?: string
): Promise<PatientCheckResult> {
  const url = `${config.patientServiceUrl}/api/patients/${patientId}/summary`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.httpTimeoutMs);

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

    clearTimeout(timeoutId);

    if (response.status === 200) {
      return { status: "FOUND" };
    }
    if (response.status === 404) {
      return { status: "NOT_FOUND" };
    }

    logger.warn({ status: response.status, patientId }, "Patient service returned unexpected status");
    return { status: "UNAVAILABLE" };
  } catch (err) {
    clearTimeout(timeoutId);
    logger.warn({ err, patientId }, "Failed to reach Patient service, falling back to unverified");
    return { status: "UNAVAILABLE" };
  }
}
