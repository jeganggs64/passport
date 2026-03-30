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

interface SessionEntry {
  frontendRedirect: string;
  result?: {
    appSpecificId: string;
    identityTier: string;
    deviceVerified: boolean;
    receipt: Record<string, unknown>;
  };
}

// In-memory store for pending sessions.
// In production, use Redis or similar shared state.
const pendingSessions = new Map<string, SessionEntry>();

/**
 * Create a verification session.
 *
 * Called by POST /procedure/ruonid/connect.
 * The callback URL points to our own /procedure/ruonid/callback endpoint.
 */
export const createSession = (
  frontendRedirect: string,
  iamBaseUrl: string,
): { qrUrl: string; universalLink: string; sessionId: string } => {
  const client = getClient();
  const callbackUrl = `${iamBaseUrl}/procedure/ruonid/callback`;
  const session = client.createVerifySession(callbackUrl);
  const qrUrl = RuonID.toDeepLink(session);
  const universalLink = RuonID.toUniversalLink(session);

  pendingSessions.set(session.sessionId, { frontendRedirect });

  // Auto-expire after 5 minutes
  setTimeout(() => pendingSessions.delete(session.sessionId), 5 * 60 * 1000);

  return { qrUrl, universalLink, sessionId: session.sessionId };
};

/**
 * Handle the callback POST from the RuonID app.
 *
 * Validates the callback with the SDK and stores the result.
 */
export const handleCallback = async (body: unknown): Promise<void> => {
  const client = getClient();
  const result = await client.handleVerifyCallback(body);

  const callbackBody = body as Record<string, unknown>;
  const sessionId = callbackBody.sessionId as string;

  const session = pendingSessions.get(sessionId);
  if (!session) {
    throw new Error("Unknown or expired session");
  }

  session.result = {
    appSpecificId: result.appSpecificId,
    identityTier: result.identityTier ?? "unknown",
    deviceVerified: result.deviceVerified ?? false,
    receipt: (result.receipt ?? {}) as Record<string, unknown>,
  };
};

/**
 * Check if a session has completed (for QR page polling).
 *
 * Returns the redirect URL if complete, null otherwise.
 * Does NOT consume the session — the provider still needs the result.
 */
export const checkSessionStatus = (sessionId: string): { complete: boolean; redirect?: string } => {
  const session = pendingSessions.get(sessionId);
  if (!session) return { complete: false };
  if (!session.result) return { complete: false };
  return { complete: true, redirect: session.frontendRedirect };
};

/**
 * Get and consume the verification result for a session.
 *
 * Called by the RuonID provider's verify() method.
 * Returns the result and deletes the session.
 */
export const consumeSessionResult = (sessionId: string) => {
  const session = pendingSessions.get(sessionId);
  if (!session?.result) return null;
  const result = session.result;
  pendingSessions.delete(sessionId);
  return result;
};
