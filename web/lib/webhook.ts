import type { Resend } from "resend";
import { verifyWebhookPayload } from "@/lib/resend";

type SvixHeaders = {
  "svix-id": string | null;
  "svix-timestamp": string | null;
  "svix-signature": string | null;
};

export function verifyWebhookEvent(
  resend: Resend,
  payload: string,
  headers: SvixHeaders,
  secret: string
) {
  return verifyWebhookPayload(resend, {
    payload,
    headers: {
      id: headers["svix-id"] ?? "",
      timestamp: headers["svix-timestamp"] ?? "",
      signature: headers["svix-signature"] ?? "",
    },
    webhookSecret: secret,
  });
}
