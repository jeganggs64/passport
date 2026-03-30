import axios from "axios";

type RuonIDSessionResponse = {
  qrPageUrl: string;
  sessionId: string;
};

/**
 * Create a new RuonID verification session.
 *
 * This calls the RuonID API to generate a signed QR code session.
 * The QR code contains a verify deeplink that the RuonID mobile app
 * can scan. When the user approves, RuonID POSTs the result to the
 * callback URL, and the session can be looked up by sessionId.
 */
export const ruonidRequestVerification = async (
  userDid: string,
  redirect: string
): Promise<RuonIDSessionResponse> => {
  return await axios
    .post(
      `${process.env.RUONID_API_URL}/session/create`,
      {
        userDid,
        redirect,
        verificationType: "sybil",
      },
      {
        headers: { "X-Api-Key": process.env.RUONID_API_KEY },
        timeout: 10_000,
      }
    )
    .then((response: { data: RuonIDSessionResponse }) => response.data);
};
