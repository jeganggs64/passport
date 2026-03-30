import crypto from "crypto";

/**
 * Generate a signed RuonID verify QR payload.
 *
 * Human Passport acts as a registered RuonID developer. This generates
 * the same signed payload that any RuonID developer would create for
 * a verify deeplink/QR code. The RuonID app scans it, the user approves,
 * and RuonID POSTs the result to the callback URL.
 *
 * No RuonID-side session API is needed — this is all local.
 */
export const generateRuonIDVerifyPayload = (
  callbackUrl: string,
  userDid: string
): {
  qrData: string;
  sessionId: string;
} => {
  const sessionId = crypto.randomUUID();
  const timestamp = Date.now();

  const developerPublicKey = process.env.RUONID_DEVELOPER_PUBLIC_KEY;
  const developerPrivateKey = process.env.RUONID_DEVELOPER_PRIVATE_KEY;

  if (!developerPublicKey || !developerPrivateKey) {
    throw new Error("RUONID_DEVELOPER_PUBLIC_KEY and RUONID_DEVELOPER_PRIVATE_KEY must be set");
  }

  // Build the verify payload — same format the RuonID app expects
  const payload = {
    type: "verify",
    sessionId,
    timestamp,
    callbackUrl,
    developerPublicKey,
  };

  // Sign the payload with the developer's secp256k1 private key
  // The RuonID app verifies this signature before showing the consent screen
  const { secp256k1 } = require("@noble/curves/secp256k1");
  const { sha256 } = require("@noble/hashes/sha256");

  const message = JSON.stringify({
    type: payload.type,
    sessionId: payload.sessionId,
    timestamp: payload.timestamp,
    callbackUrl: payload.callbackUrl,
  });
  const msgHash = sha256(new TextEncoder().encode(message));
  const signature = secp256k1.sign(msgHash, developerPrivateKey);
  const sessionProof = signature.toCompactHex();

  const qrPayload = {
    ...payload,
    sessionProof,
  };

  // Encode as a ruonid:// deeplink for the QR code
  const params = new URLSearchParams({
    type: "verify",
    sessionId,
    timestamp: String(timestamp),
    callbackUrl,
    developerPublicKey,
    sessionProof,
  });

  const qrData = `ruonid://verify?${params.toString()}`;

  return { qrData, sessionId };
};
