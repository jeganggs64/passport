import { PlatformSpec, PlatformGroupSpec, Provider } from "../types.js";
import { RuonIDProvider } from "./Providers/ruonid.js";

export const PlatformDetails: PlatformSpec = {
  icon: "./assets/ruonidStampIcon.svg",
  platform: "RuonID",
  name: "RuonID",
  description:
    "Passport-based proof of unique humanity. Reads your passport's NFC chip and verifies you cryptographically — no personal data leaves your phone.",
  connectMessage: "Verify Identity",
  website: "https://ruonlabs.com",
  timeToGet: "2 minutes",
  price: "Free",
  guide: [
    {
      type: "steps",
      title: "How to Verify",
      items: [
        {
          title: "Step 1: Install RuonID",
          description: "Download the RuonID app on iOS or Android.",
          actions: [
            {
              label: "Get RuonID",
              href: "https://ruonlabs.com/download",
            },
          ],
        },
        {
          title: "Step 2: Click Verify below",
          description: "A QR code will appear. Open RuonID and scan it.",
        },
        {
          title: "Step 3: Tap your passport",
          description:
            "Hold your passport against your phone's NFC reader. RuonID reads the chip and verifies the cryptographic signature — your data stays on your device.",
        },
        {
          title: "Step 4: Approve",
          description: "Review and approve the verification. Your stamp will be issued automatically.",
        },
      ],
    },
    {
      type: "list",
      title: "Requirements",
      items: [
        "An NFC-enabled phone (most phones since 2015)",
        "A biometric passport (issued after ~2006, has the chip symbol on the cover)",
        "The RuonID app installed",
      ],
    },
  ],
};

export const ProviderConfig: PlatformGroupSpec[] = [
  {
    platformGroup: "Passport Verification",
    providers: [
      {
        title: "Verified unique human via NFC passport",
        description:
          "Proves you are a unique human by cryptographically verifying your passport's NFC chip. No personal data is shared.",
        name: "RuonID",
      },
    ],
  },
];

export const providers: Provider[] = [new RuonIDProvider()];
