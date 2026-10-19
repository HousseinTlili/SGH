import { config } from "../config/index.js";
import { lookupPeer, PeerLookup } from "./peerClient.js";

/** REC-5 / REC-6: does the Patient service know this patient? */
export function checkPatientSummary(
  patientId: string,
  token?: string | null,
  correlationId?: string
): Promise<PeerLookup> {
  return lookupPeer(
    `${config.patientServiceUrl}/api/patients/${patientId}/summary`,
    "patient",
    token,
    correlationId
  );
}
