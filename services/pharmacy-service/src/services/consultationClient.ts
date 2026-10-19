import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

export type ConsultationVerificationResult =
  | { reachable: true; exists: boolean }
  | { reachable: false };

export async function verifyPrescriptionWithConsultation(
  consultationId: string,
  prescriptionId: string,
  token?: string,
  correlationId?: string
): Promise<ConsultationVerificationResult> {
  const url = `${config.consultationServiceUrl}/api/consultations/${consultationId}/prescriptions`;
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
      signal: AbortSignal.timeout(config.httpTimeoutMs)
    });

    if (response.status === 200) {
      const prescriptions = (await response.json()) as Array<{ id: string }>;
      const exists = Array.isArray(prescriptions) && prescriptions.some((p) => p.id === prescriptionId);
      return { reachable: true, exists };
    }

    if (response.status === 404) {
      await response.body?.cancel();
      return { reachable: true, exists: false };
    }

    await response.body?.cancel();
    logger.warn(
      { status: response.status, consultationId, prescriptionId },
      "Consultation service returned non-200/404, falling back to local copy (PHA-7)"
    );
    return { reachable: false };
  } catch (err) {
    logger.warn(
      { err, consultationId, prescriptionId },
      "Failed to reach Consultation service (timeout or down), falling back to local copy (PHA-7)"
    );
    return { reachable: false };
  }
}
