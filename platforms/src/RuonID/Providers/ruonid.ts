import { type Provider, type ProviderOptions } from "../../types.js";
import type { RequestPayload, VerifiedPayload } from "@gitcoin/passport-types";
import { consumeSessionResult } from "../procedures/ruonidVerification.js";

/**
 * RuonID Provider — verifies passport-based sybil resistance.
 *
 * Reads the verification result that was stored by the procedure
 * callback handler when the RuonID app POSTed to /procedure/ruonid/callback.
 */
export class RuonIDProvider implements Provider {
  type = "RuonID";
  _options: ProviderOptions = {};

  constructor(options: ProviderOptions = {}) {
    this._options = { ...this._options, ...options };
  }

  async verify(payload: RequestPayload): Promise<VerifiedPayload> {
    const errors: string[] = [];
    const sessionId = payload.proofs?.sessionId;

    if (!sessionId) {
      return { valid: false, errors: ["Missing session ID"], record: { id: "" } };
    }

    const result = consumeSessionResult(sessionId);
    if (!result) {
      return {
        valid: false,
        errors: ["Verification not completed. Please scan the QR code with the RuonID app and approve."],
        record: { id: "" },
      };
    }

    if (!result.appSpecificId || !result.deviceVerified) {
      errors.push("RuonID verification was not completed successfully.");
      return { valid: false, errors, record: { id: "" } };
    }

    if (!result.receipt || Object.keys(result.receipt).length === 0) {
      errors.push("RuonID verification is missing a valid receipt.");
      return { valid: false, errors, record: { id: "" } };
    }

    return {
      valid: true,
      errors: [],
      record: { id: result.appSpecificId },
    };
  }
}
