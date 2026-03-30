import React from "react";
import axios from "axios";
import { AppContext, PlatformOptions, ProviderPayload } from "../types.js";
import { Platform } from "../utils/platform.js";

export class RuonIDPlatform extends Platform {
  platformId = "RuonID";
  path = "ruonid";
  clientId: string = null;
  redirectUri: string = null;

  banner = {
    heading: (
      <>
        To get the Stamp:
        <br className="mb-1" />
        <ol>
          <li className="mt-1">Step 1: Click &ldquo;Verify&rdquo; below</li>
          <li className="mt-1">Step 2: Scan the QR code with the RuonID app</li>
          <li className="mt-1">Step 3: Tap your passport on your phone&rsquo;s NFC reader</li>
          <li className="mt-1">Step 4: Approve the verification — your Stamp is issued</li>
        </ol>
        <br />
        RuonID reads the cryptographic chip in your passport to prove you are a unique human. All data stays on your
        phone — nothing is uploaded or stored.
      </>
    ),
    cta: {
      label: "Learn more",
      url: "https://ruonlabs.com",
    },
  };

  constructor(options: PlatformOptions = {}) {
    super();
    this.clientId = options.clientId as string;
    this.redirectUri = options.redirectUri as string;
  }

  async getProviderPayload(appContext: AppContext): Promise<ProviderPayload> {
    const width = 500;
    const height = 600;
    const left = appContext.screen.width / 2 - width / 2;
    const top = appContext.screen.height / 2 - height / 2;

    const windowReference = appContext.window.open(
      "about:blank",
      "_blank",
      `toolbar=no, location=no, directories=no, status=no, menubar=no, resizable=no, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
    ) as unknown as Window;

    if (windowReference === null || windowReference === undefined) {
      throw new Error("Failed to open popup window");
    }

    try {
      // Request a verification session from the RuonID procedure endpoint.
      // This creates a signed QR code session and returns the URL to display it.
      const { qrPageUrl, sessionId } = (
        await axios.post(`${process.env.NEXT_PUBLIC_PASSPORT_PROCEDURE_URL?.replace(/\/*?$/, "")}/ruonid/connect`, {
          callback: `${this.redirectUri}?error=false&code=null&state=${appContext.state}`,
          userDid: appContext.userDid,
        })
      ).data as { qrPageUrl: string; sessionId: string };

      // Redirect the popup to show the QR code for the user to scan with RuonID
      windowReference.location = qrPageUrl;

      // Wait for the user to complete verification and redirect back
      const response = await appContext.waitForRedirect(this);

      return {
        sessionId,
        code: "success",
        sessionKey: response.state,
        userDid: appContext.userDid,
      };
    } catch (e) {
      windowReference.close();
      throw e;
    }
  }
}
