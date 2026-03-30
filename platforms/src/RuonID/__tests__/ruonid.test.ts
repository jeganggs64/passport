import { RequestPayload } from "@gitcoin/passport-types";
import { RuonIDProvider } from "../Providers/ruonid";

// Mock the procedure module
jest.mock("../procedures/ruonidVerification", () => ({
  consumeSessionResult: jest.fn(),
}));

import { consumeSessionResult } from "../procedures/ruonidVerification";
const mockedConsume = consumeSessionResult as jest.MockedFunction<typeof consumeSessionResult>;

const appSpecificId = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const sessionId = "sess_abc123";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RuonIDProvider", () => {
  const provider = new RuonIDProvider();

  it("handles valid verification", async () => {
    mockedConsume.mockReturnValue({
      appSpecificId,
      identityTier: "passport-bound",
      deviceVerified: true,
      receipt: { payloadHash: "abc", deviceAttestation: "def", serverSignature: "ghi" },
    });

    const result = await provider.verify({
      proofs: { sessionId },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(true);
    expect(result.record).toEqual({ id: appSpecificId });
    expect(mockedConsume).toHaveBeenCalledWith(sessionId);
  });

  it("rejects when device not verified", async () => {
    mockedConsume.mockReturnValue({
      appSpecificId,
      identityTier: "passport-bound",
      deviceVerified: false,
      receipt: { payloadHash: "abc", deviceAttestation: "def", serverSignature: "ghi" },
    });

    const result = await provider.verify({
      proofs: { sessionId },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
  });

  it("rejects when receipt is empty", async () => {
    mockedConsume.mockReturnValue({
      appSpecificId,
      identityTier: "passport-bound",
      deviceVerified: true,
      receipt: {},
    });

    const result = await provider.verify({
      proofs: { sessionId },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
  });

  it("rejects when session not found", async () => {
    mockedConsume.mockReturnValue(null);

    const result = await provider.verify({
      proofs: { sessionId: "nonexistent" },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not completed");
  });

  it("handles missing sessionId", async () => {
    const result = await provider.verify({
      proofs: {},
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Missing session ID");
    expect(mockedConsume).not.toHaveBeenCalled();
  });

  it("rejects when appSpecificId is empty", async () => {
    mockedConsume.mockReturnValue({
      appSpecificId: "",
      identityTier: "passport-bound",
      deviceVerified: true,
      receipt: { serverSignature: "abc" },
    });

    const result = await provider.verify({
      proofs: { sessionId },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
  });
});
