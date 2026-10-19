import { config } from "../config/index.js";
import { lookupPeer, PeerLookup } from "./peerClient.js";

/** REC-7: does the Staff service know this doctor? */
export function checkDoctorPublic(
  doctorId: string,
  token?: string | null,
  correlationId?: string
): Promise<PeerLookup> {
  return lookupPeer(
    `${config.staffServiceUrl}/api/staff/${doctorId}/public`,
    "staff",
    token,
    correlationId
  );
}
