import http from "node:http";
import { AddressInfo } from "node:net";

/**
 * Programmable stand-in for GET /api/consultations/{id}/prescriptions of the Consultation service,
 * so PHA-7 (verify, or fall back to the local copy) is tested against real HTTP failures.
 */
type Mode = "ok" | "missing" | "not-found" | "error" | "reset" | "hang";

export const consultation = {
  /** Default: the service is down, so dispensing runs on the local copy (PHA-7 fallback). */
  mode: "error" as Mode,
  /** Prescription ids the "ok" mode reports as present. */
  ids: [] as string[],
  /** Authorization / correlation headers received, newest last. */
  auth: [] as (string | undefined)[],
  correlation: [] as (string | undefined)[],
  reset() {
    this.mode = "error";
    this.ids = [];
    this.auth = [];
    this.correlation = [];
  }
};

let server: http.Server | null = null;

export async function startConsultationStub(): Promise<string> {
  server = http.createServer((req, res) => {
    consultation.auth.push(req.headers.authorization);
    consultation.correlation.push(req.headers["x-correlation-id"] as string | undefined);
    res.setHeader("Content-Type", "application/json");
    switch (consultation.mode) {
      case "ok":
        res.end(JSON.stringify(consultation.ids.map((id) => ({ id }))));
        return;
      case "missing":
        res.end("[]");
        return;
      case "not-found":
        res.statusCode = 404;
        res.end("{}");
        return;
      case "error":
        res.statusCode = 503;
        res.end();
        return;
      case "reset":
        req.socket.destroy();
        return;
      case "hang":
        return;
    }
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export async function stopConsultationStub(): Promise<void> {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
}
