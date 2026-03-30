import { RequestPayload } from "@gitcoin/passport-types";
import { RuonIDProvider, verificationResults } from "../Providers/ruonid.js";

const appSpecificId = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const sessionId = "sess_abc123";

beforeEach(() => {
  verificationResults.clear();
});

describe("RuonIDProvider", () => {
  it("handles valid verification", async () => {
    verificationResults.set(sessionId, {
      appSpecificId,
      identityTier: "passport-bound",
      deviceVerified: true,
      timestamp: "2026-03-30T00:00:00Z",
      receipt: {
        payloadHash: "abc",
        deviceAttestation: "def",
        serverSignature: "ghi",
      },
    });

    const provider = new RuonIDProvider();
    const result = await provider.verify({
      proofs: { sessionId },
    } as unknown as RequestPayload);

    expect(result).toEqual({
      valid: true,
      errors: [],
      record: { id: appSpecificId },
    });

    // Session should be consumed (single-use)
    expect(verificationResults.has(sessionId)).toBe(false);
  });

  it("rejects when device not verified", async () => {
    verificationResults.set(sessionId, {
      appSpecificId,
      identityTier: "passport-bound",
      deviceVerified: false,
      timestamp: "2026-03-30T00:00:00Z",
      receipt: { payloadHash: "abc", deviceAttestation: "def", serverSignature: "ghi" },
    });

    const provider = new RuonIDProvider();
    const result = await provider.verify({
      proofs: { sessionId },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects when receipt is missing", async () => {
    verificationResults.set(sessionId, {
      appSpecificId,
      identityTier: "passport-bound",
      deviceVerified: true,
      timestamp: "2026-03-30T00:00:00Z",
      receipt: null as any,
    });

    const provider = new RuonIDProvider();
    const result = await provider.verify({
      proofs: { sessionId },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
  });

  it("rejects when session not found", async () => {
    const provider = new RuonIDProvider();
    const result = await provider.verify({
      proofs: { sessionId: "nonexistent" },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not yet completed");
  });

  it("handles missing sessionId", async () => {
    const provider = new RuonIDProvider();
    const result = await provider.verify({
      proofs: {},
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Missing session ID");
  });
});
