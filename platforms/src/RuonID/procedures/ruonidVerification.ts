import { RuonID } from "@ruonid/sdk";

let _client: RuonID | null = null;

function getClient(): RuonID {
  if (!_client) {
    const privateKey = process.env.RUONID_DEVELOPER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("RUONID_DEVELOPER_PRIVATE_KEY must be set");
    }
    _client = new RuonID(privateKey);
  }
  return _client;
}

/**
 * Create a RuonID sybil-verification session.
 *
 * Returns a QR payload (as a universal link URL) and sessionId.
 * The popup displays this as a QR code for the user to scan with RuonID.
 */
export const createRuonIDSession = (
  callbackUrl: string
): { qrUrl: string; sessionId: string } => {
  const client = getClient();
  const session = client.createVerifySession(callbackUrl);
  const qrUrl = RuonID.toUniversalLink(session);
  return { qrUrl, sessionId: session.sessionId };
};

/**
 * Handle the callback POST from the RuonID app.
 *
 * Called by the IAM procedure endpoint when RuonID POSTs the result.
 * Returns the verified appSpecificId or throws on invalid callback.
 */
export const handleRuonIDCallback = async (
  body: unknown
): Promise<{ appSpecificId: string; identityTier: string; deviceVerified: boolean; receipt: Record<string, unknown> }> => {
  const client = getClient();
  const result = await client.handleVerifyCallback(body);
  return {
    appSpecificId: result.appSpecificId,
    identityTier: result.identityTier ?? "unknown",
    deviceVerified: result.deviceVerified ?? false,
    receipt: result.receipt ?? {},
  };
};
