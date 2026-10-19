import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

export async function checkDoctorPublic(
  doctorId: string,
  token?: string,
  correlationId?: string
): Promise<boolean> {
  const url = `${config.staffServiceUrl}/api/staff/${doctorId}/public`;
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

    // If 200, doctor exists and is public
    return response.status === 200;
  } catch (err) {
    clearTimeout(timeoutId);
    logger.warn({ err, doctorId }, "Failed to reach Staff service (REC-7), proceeding anyway");
    return true; // Fallback: allow booking even if staff service is unreachable
  }
}
