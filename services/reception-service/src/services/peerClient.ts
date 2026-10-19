import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

export type PeerLookup = "FOUND" | "NOT_FOUND" | "UNAVAILABLE";

/**
 * GET on a peer service with the shared timeout, forwarding Authorization and X-Correlation-Id (X-4).
 * 200 -> FOUND, 404 -> NOT_FOUND (a real answer); timeouts, connection errors and 5xx -> UNAVAILABLE,
 * which callers turn into their documented fallback.
 */
export async function lookupPeer(
  url: string,
  what: string,
  token?: string | null,
  correlationId?: string
): Promise<PeerLookup> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (correlationId) headers["X-Correlation-Id"] = correlationId;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(config.httpTimeoutMs)
    });
    // Nothing is read from the body, so release the connection.
    await response.body?.cancel();

    if (response.status === 200) return "FOUND";
    if (response.status === 404) return "NOT_FOUND";
    logger.warn({ status: response.status, what, correlationId }, "Peer service answered unexpectedly");
    return "UNAVAILABLE";
  } catch (err) {
    logger.warn({ err, what, correlationId }, "Peer service unreachable");
    return "UNAVAILABLE";
  }
}
