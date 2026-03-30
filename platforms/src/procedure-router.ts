// ---- Server
import { Request, Response, Router } from "express";

import * as twitterOAuth from "./Twitter/procedures/twitterOauth.js";
import { triggerBrightidSponsorship, verifyBrightidContextId } from "./Brightid/procedures/brightid.js";
import path from "path";
import * as idenaSignIn from "./Idena/procedures/idenaSignIn.js";
import { outdidRequestVerification } from "./Outdid/procedures/outdidVerification.js";
import { createSession as ruonidCreateSession, handleCallback as ruonidHandleCallback, checkSessionStatus as ruonidCheckStatus } from "./RuonID/procedures/ruonidVerification.js";

export const router = Router();

export type GenerateTwitterAuthUrlRequestBody = {
  callback?: string;
};

export type GenerateBrightidBody = {
  contextIdData: string;
};

export type IdenaStartSessionRequestBody = {
  token: string;
  address: string;
};

export type IdenaAuthenticateRequestBody = {
  token: string;
  signature: string;
};

router.post("/twitter/generateAuthUrl", (req: Request, res: Response): void => {
  const { callback: callbackOverride } = req.body as GenerateTwitterAuthUrlRequestBody;
  twitterOAuth.initClientAndGetAuthUrl(callbackOverride).then((authUrl) => {
    const data = {
      authUrl,
    };

    res.status(200).send(data);
  });
});

router.post("/brightid/sponsor", (req: Request, res: Response): void => {
  const { contextIdData } = req.body as GenerateBrightidBody;
  if (contextIdData) {
    return void triggerBrightidSponsorship(contextIdData).then((response) => {
      return res.status(200).send({ response });
    });
  } else {
    res.status(400);
  }
});

router.post("/brightid/verifyContextId", (req: Request, res: Response): void => {
  const { contextIdData } = req.body as GenerateBrightidBody;
  if (contextIdData) {
    return void verifyBrightidContextId(contextIdData).then((response) => {
      return res.status(200).send({ response });
    });
  } else {
    res.status(400);
  }
});

router.get("/brightid/information", (req: Request, res: Response): void => {
  const callback = ((req.query.callback as string) || "").replace(/\/$/, "");
  const allowed_callback = process.env.GENERIC_CALLBACK_URL.replace(/\/$/, "");

  if (callback !== allowed_callback) {
    res.status(400).send("Invalid callback");
    return;
  }

  const staticPath =
    process.env.CURRENT_ENV === "development"
      ? "src/static/bright-id-template.html"
      : "iam/src/static/bright-id-template.html";
  res.sendFile(path.resolve(process.cwd(), staticPath));
});

router.get("/brightid/script.js", (req: Request, res: Response): void => {
  const staticPath =
    process.env.CURRENT_ENV === "development" ? "src/static/bright-id-script.js" : "iam/src/static/bright-id-script.js";
  res.sendFile(path.resolve(process.cwd(), staticPath));
});

router.post("/idena/create-token", (req: Request, res: Response): void => {
  idenaSignIn
    .initSession()
    .then((token) => {
      const data = {
        token: token,
      };
      res.status(200).send(data);
    })
    .catch((error) => {
      res.status(400).send({
        error: `An error was encountered while creating a new token: ${String(error)}`,
      });
    });
});

router.post("/idena/start-session", (req: Request, res: Response): void => {
  const { token, address } = req.body as IdenaStartSessionRequestBody;
  if (!token || !address) {
    res.status(200).send({
      error: "bad request",
    });
    return;
  }
  idenaSignIn
    .loadIdenaSession(token, address)
    .then((nonce) => {
      if (!nonce) {
        res.status(200).send({
          error: "something went wrong while starting new session",
        });
        return;
      }
      const data = {
        success: true,
        data: {
          nonce: nonce,
        },
      };
      res.status(200).send(data);
    })
    .catch((error) => {
      res.status(400).send({
        error: `An error was encountered while starting the session: ${String(error)}`,
      });
    });
});

router.post("/idena/authenticate", (req: Request, res: Response): void => {
  const { token, signature } = req.body as IdenaAuthenticateRequestBody;
  if (!token || !signature) {
    res.status(200).send({
      error: "bad request",
    });
    return;
  }
  return void idenaSignIn
    .authenticate(token, signature)
    .then((authenticated) => {
      if (!authenticated) {
        res.status(200).send({
          success: false,
          error: "authentication failed",
        });
        return;
      }
      const data = {
        success: true,
        data: {
          authenticated: true,
        },
      };
      res.status(200).send(data);
    })
    .catch((error) => {
      if (error) {
        res.status(200).send({
          error: "something went wrong while starting new session",
        });
      }
    });
});

// ── RuonID: passport-based sybil resistance ──────────────────────────────

// Step 1: Frontend requests a verification session
router.post("/ruonid/connect", (req: Request, res: Response): void => {
  const body = req.body as { callback?: string; userDid?: string };
  if (!body?.callback || !body?.userDid) {
    res.status(400).send({ error: "Missing callback or userDid" });
    return;
  }

  try {
    const iamBaseUrl = (process.env.IAM_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const { qrUrl, sessionId } = ruonidCreateSession(body.callback, iamBaseUrl);

    // Return the QR page URL (served by this router) and sessionId
    const qrPageUrl = `${iamBaseUrl}/procedure/ruonid/qr?sessionId=${encodeURIComponent(sessionId)}&qrUrl=${encodeURIComponent(qrUrl)}`;

    res.status(200).send({ qrPageUrl, sessionId });
  } catch (error) {
    res.status(500).send({ error: String(error) });
  }
});

// Step 2: Serve the QR code page (displayed in the popup)
router.get("/ruonid/qr", (req: Request, res: Response): void => {
  const qrUrl = req.query.qrUrl as string;
  const sessionId = req.query.sessionId as string;

  if (!qrUrl || !sessionId) {
    res.status(400).send("Missing parameters");
    return;
  }

  // Inline HTML page that renders a QR code and a clickable universal link
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify with RuonID</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0A0F1A;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    h2 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #8899AA; font-size: 14px; margin-bottom: 24px; text-align: center; }
    #qr-container {
      background: #fff;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 24px;
    }
    #qr-canvas { display: block; }
    .open-link {
      display: inline-block;
      background: #2563EB;
      color: #fff;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .open-link:hover { background: #1D4ED8; }
    .waiting {
      color: #8899AA;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid #334;
      border-top-color: #2563EB;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <h2>Scan with RuonID</h2>
  <p class="subtitle">Open the RuonID app and scan this QR code,<br>or tap the button below on your phone.</p>
  <div id="qr-container">
    <canvas id="qr-canvas"></canvas>
  </div>
  <a class="open-link" href="${qrUrl.replace(/"/g, "&quot;")}">Open in RuonID</a>
  <div class="waiting">
    <div class="spinner"></div>
    Waiting for verification...
  </div>
  <script>
    QRCode.toCanvas(document.getElementById('qr-canvas'), ${JSON.stringify(qrUrl)}, {
      width: 280,
      margin: 0,
      color: { dark: '#0A0F1A', light: '#FFFFFF' }
    });

    // Poll for completion — when the callback is received, the server
    // will respond with a redirect URL
    const sessionId = ${JSON.stringify(sessionId)};
    (async function poll() {
      try {
        const res = await fetch('/procedure/ruonid/status?sessionId=' + encodeURIComponent(sessionId));
        const data = await res.json();
        if (data.complete && data.redirect) {
          window.location.href = data.redirect;
          return;
        }
      } catch {}
      setTimeout(poll, 2000);
    })();
  </script>
</body>
</html>`);
});

// Step 3: RuonID app POSTs the verification result here
router.post("/ruonid/callback", (req: Request, res: Response): void => {
  ruonidHandleCallback(req.body)
    .then(({ frontendRedirect }) => {
      // Respond to the RuonID app with success
      res.status(200).send({ success: true });
    })
    .catch((error) => {
      res.status(400).send({ error: String(error) });
    });
});

// Step 4: QR page polls this to check if verification is complete
router.get("/ruonid/status", (req: Request, res: Response): void => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).send({ error: "Missing sessionId" });
    return;
  }

  const status = ruonidCheckStatus(sessionId);
  res.status(200).send(status);
});

router.post("/outdid/connect", (req: Request, res: Response): void => {
  const body = req.body as { userDid?: string; callback?: string };
  if (body && body.userDid && body.callback) {
    outdidRequestVerification(body.userDid, body.callback)
      .then((response) => {
        res.status(200).send(response);
      })
      .catch((_) => {
        res.status(400).send();
      });
  } else {
    res.status(400).send();
  }
});
