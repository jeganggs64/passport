import { RequestPayload } from "@gitcoin/passport-types";
import { RuonIDProvider } from "../Providers/ruonid.js";
import { ruonidRequestVerification } from "../procedures/ruonidVerification.js";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const userDid = "did:pkh:eip155:1:0xabcdef1234567890";
const appSpecificId = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const sessionId = "sess_abc123";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RuonIDProvider", () => {
  async function mockProvider(mockedResponse: object) {
    mockedAxios.get.mockImplementation(async () => mockedResponse);

    const provider = new RuonIDProvider();
    return provider.verify({
      proofs: { sessionId, userDid },
    } as unknown as RequestPayload);
  }

  it("handles valid verification", async () => {
    const result = await mockProvider({
      data: {
        appSpecificId,
        identityTier: "passport-bound",
        deviceVerified: true,
        timestamp: "2026-03-30T00:00:00Z",
        receipt: {
          payloadHash: "abc",
          deviceAttestation: "def",
          serverSignature: "ghi",
        },
      },
      status: 200,
    });

    expect(result).toEqual({
      valid: true,
      errors: [],
      record: { id: appSpecificId },
    });
  });

  it("rejects when device not verified", async () => {
    const result = await mockProvider({
      data: {
        appSpecificId,
        identityTier: "passport-bound",
        deviceVerified: false,
        timestamp: "2026-03-30T00:00:00Z",
        receipt: { payloadHash: "abc", deviceAttestation: "def", serverSignature: "ghi" },
      },
      status: 200,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects when receipt is missing", async () => {
    const result = await mockProvider({
      data: {
        appSpecificId,
        identityTier: "passport-bound",
        deviceVerified: true,
        timestamp: "2026-03-30T00:00:00Z",
        receipt: {},
      },
      status: 200,
    });

    expect(result.valid).toBe(false);
  });

  it("rejects when appSpecificId is empty", async () => {
    const result = await mockProvider({
      data: {
        appSpecificId: "",
        identityTier: "passport-bound",
        deviceVerified: true,
        timestamp: "2026-03-30T00:00:00Z",
        receipt: { payloadHash: "abc", deviceAttestation: "def", serverSignature: "ghi" },
      },
      status: 200,
    });

    expect(result.valid).toBe(false);
  });

  it("handles API errors", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    const provider = new RuonIDProvider();
    const result = await provider.verify({
      proofs: { sessionId, userDid },
    } as unknown as RequestPayload);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Error verifying with RuonID");
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

describe("ruonidRequestVerification", () => {
  it("creates a verification session", async () => {
    const qrPageUrl = "https://ruonlabs.com/verify/sess_abc123";
    mockedAxios.post.mockResolvedValue({
      data: { qrPageUrl, sessionId },
      status: 200,
    });

    const result = await ruonidRequestVerification(userDid, "https://passport.xyz/callback");

    expect(mockedAxios.post).toBeCalledTimes(1);
    expect(result).toEqual({ qrPageUrl, sessionId });
  });
});
