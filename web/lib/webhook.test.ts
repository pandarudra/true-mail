import { describe, it, expect } from "vitest";
import { Resend } from "resend";
import { verifyWebhookEvent } from "./webhook";

describe("verifyWebhookEvent", () => {
  it("rejects a payload with a mismatched signature", () => {
    const resend = new Resend("re_test_placeholder");
    const payload = JSON.stringify({ type: "email.received", data: {} });

    expect(() =>
      verifyWebhookEvent(
        resend,
        payload,
        {
          "svix-id": "msg_test",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "v1,thisisnotavalidsignature==",
        },
        "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"
      )
    ).toThrow();
  });
});
