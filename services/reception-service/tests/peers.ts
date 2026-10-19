import http from "node:http";
import { AddressInfo } from "node:net";

/**
 * Programmable stand-in for the Patient service, the Staff service and the Keycloak token endpoint,
 * so the fallback rules (REC-5, REC-6, REC-7) are tested against real HTTP failures.
 */
type Mode = "ok" | "not-found" | "error" | "reset" | "hang";

export const peers = {
  patient: "ok" as Mode,
  staff: "ok" as Mode,
  token: "ok" as Mode,
  /** Authorization headers received by the Patient stub, newest last. */
  patientAuth: [] as (string | undefined)[],
  patientCorrelation: [] as (string | undefined)[],
  reset() {
    this.patient = "ok";
    this.staff = "ok";
    this.token = "ok";
    this.patientAuth = [];
    this.patientCorrelation = [];
  }
};

function answer(mode: Mode, req: http.IncomingMessage, res: http.ServerResponse, okBody: object): void {
  switch (mode) {
    case "ok":
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(okBody));
      return;
    case "not-found":
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
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
      return; // never answers: the caller's timeout must fire
  }
}

let server: http.Server | null = null;

export async function startPeers(): Promise<string> {
  server = http.createServer((req, res) => {
    const url = req.url ?? "";
    if (url.startsWith("/api/patients/")) {
      peers.patientAuth.push(req.headers.authorization);
      peers.patientCorrelation.push(req.headers["x-correlation-id"] as string | undefined);
      return answer(peers.patient, req, res, { id: "x", fullName: "Test Patient", birthDate: "1990-01-01" });
    }
    if (url.startsWith("/api/staff/")) {
      return answer(peers.staff, req, res, { id: "x", fullName: "Dr Test", role: "DOCTOR" });
    }
    if (url.startsWith("/token")) {
      return answer(peers.token, req, res, { access_token: "service-token", expires_in: 300 });
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export async function stopPeers(): Promise<void> {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
}
