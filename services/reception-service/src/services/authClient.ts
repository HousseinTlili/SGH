import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getReceptionServiceToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30000) {
    return cachedToken;
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", config.receptionClientId);
    params.append("client_secret", config.receptionClientSecret);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.httpTimeoutMs);

    const response = await fetch(config.keycloakTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString(),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, "Failed to get service account token from Keycloak");
      return null;
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 300) * 1000;
    return cachedToken;
  } catch (err) {
    logger.warn({ err }, "Exception fetching reception service account token");
    return null;
  }
}
