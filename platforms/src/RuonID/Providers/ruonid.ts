import { type Provider, type ProviderOptions } from "../../types.js";
import type { RequestPayload, VerifiedPayload } from "@gitcoin/passport-types";
import axios from "axios";

type RuonIDVerification = {
  appSpecificId: string;
  identityTier: string;
  deviceVerified: boolean;
  timestamp: string;
  receipt: {
    payloadHash: string;
    deviceAttestation: string;
    serverSignature: string;
  };
};

export class RuonIDProvider implements Provider {
  type = "RuonID";
  _options: ProviderOptions = {};

  constructor(options: ProviderOptions = {}) {
    this._options = { ...this._options, ...options };
  }

  async verify(payload: RequestPayload): Promise<VerifiedPayload> {
    let valid = false;
    let appSpecificId = "";
    const errors: string[] = [];

    try {
      const sessionId = payload.proofs?.sessionId;
      if (!sessionId) {
        errors.push("Missing session ID from RuonID verification flow.");
        return { valid: false, errors, record: { id: "" } };
      }

      // Look up the completed verification session.
      // The RuonID app POSTs the result to our callback when the user approves,
      // and the procedure endpoint stores it keyed by sessionId.
      const verificationData: RuonIDVerification = await axios
        .get(
          `${process.env.RUONID_API_URL}/session/${encodeURIComponent(sessionId)}`,
          {
            headers: { "X-Api-Key": process.env.RUONID_API_KEY },
            timeout: 10_000,
          }
        )
        .then((response: { data: RuonIDVerification }) => response.data);

      appSpecificId = verificationData.appSpecificId;

      if (!appSpecificId || !verificationData.deviceVerified) {
        errors.push("RuonID verification was not completed successfully.");
      } else if (!verificationData.receipt?.serverSignature) {
        errors.push("RuonID verification is missing a valid receipt.");
      } else {
        valid = true;
      }
    } catch (e) {
      errors.push("Error verifying with RuonID: " + String(e));
    }

    return {
      valid,
      errors,
      record: { id: appSpecificId },
    };
  }
}
