import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

export interface StaffPublicProfile {
  id: string;
  fullName: string;
  role: string;
  specialty?: string | null;
}

export async function fetchDoctorSpecialty(
  staffId: string,
  token?: string,
  correlationId?: string
): Promise<string | null> {
  const url = `${config.staffServiceUrl}/api/staff/${staffId}/public`;
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
      const data = (await response.json()) as StaffPublicProfile;
      return data.specialty || null;
    }

    logger.warn(
      { status: response.status, staffId },
      "Staff service returned non-200, falling back to null specialty"
    );
    return null;
  } catch (err) {
    clearTimeout(timer);
    logger.warn({ err, staffId }, "Failed to fetch staff profile, falling back to null specialty");
    return null;
  }
}
