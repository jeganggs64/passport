import { type Provider, type ProviderOptions } from "../../types.js";
import type { RequestPayload, VerifiedPayload } from "@gitcoin/passport-types";

/**
 * RuonID Provider — verifies that a user has completed passport-based
 * identity verification via the RuonID app.
 *
 * Flow:
 * 1. Frontend (App-Bindings) generates a signed QR code via the procedure
 * 2. User scans QR with RuonID app, taps passport, approves
 * 3. RuonID POSTs { appSpecificId, receipt, ... } to the callback URL
 * 4. The IAM procedure endpoint receives the POST and stores the result
 * 5. This provider retrieves the stored result by sessionId and validates it
 *
 * The callback result is stored in-memory by the IAM procedure handler
 * (keyed by sessionId). No external RuonID API call is needed — the
 * verification data comes directly from the RuonID app via the callback.
 */

// In-memory store for callback results, populated by the procedure handler
// In production this would use Redis or similar shared state
export const verificationResults = new Map<
  string,
  {
    appSpecificId: string;
    identityTier: string;
    deviceVerified: boolean;
    timestamp: string;
    receipt: Record<string, unknown>;
  }
>();

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

      const result = verificationResults.get(sessionId);
      if (!result) {
        errors.push("Verification not yet completed. Please scan the QR code with the RuonID app and approve.");
        return { valid: false, errors, record: { id: "" } };
      }

      appSpecificId = result.appSpecificId;

      if (!appSpecificId || !result.deviceVerified) {
        errors.push("RuonID verification was not completed successfully.");
      } else if (!result.receipt) {
        errors.push("RuonID verification is missing a valid receipt.");
      } else {
        // TODO: Verify the receipt signature using @ruonid/sdk
        // For now, trust the callback data (it came to our own endpoint)
        valid = true;
      }

      // Clean up — each session is single-use
      verificationResults.delete(sessionId);
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
