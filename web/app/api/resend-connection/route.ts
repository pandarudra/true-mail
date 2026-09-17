import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { getUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const connection = await prisma.resendConnection.findUnique({
    where: { userId },
    select: { id: true, createdAt: true },
  });
  return NextResponse.json({ connected: !!connection, connection });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const apiKey: string | undefined = body?.apiKey;
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const webhookBaseUrl = process.env.RESEND_WEBHOOK_BASE_URL ?? process.env.APP_URL;
  if (!webhookBaseUrl?.startsWith("https://")) {
    return NextResponse.json(
      {
        error:
          "RESEND_WEBHOOK_BASE_URL (or APP_URL) must be a public HTTPS URL so Resend can deliver webhooks (e.g. an ngrok tunnel in development, or your deployed domain in production). It is currently: " +
          webhookBaseUrl,
      },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);
  const { error: validateError } = await resend.domains.list();
  if (validateError) {
    return NextResponse.json(
      { error: "Invalid Resend API key" },
      { status: 400 }
    );
  }

  // Reconnecting (e.g. rotating the key) must not disturb existing Domains/
  // Mailboxes — they cascade off ResendConnection.id, so we upsert in place
  // rather than delete-then-create. The new webhook is verified working
  // before any database write, so a failed reconnect never corrupts a
  // previously-working connection.
  const existing = await prisma.resendConnection.findUnique({ where: { userId } });
  const connectionId = existing?.id ?? randomUUID();

  const endpoint = `${webhookBaseUrl}/api/webhooks/resend/${connectionId}`;
  const { data: webhook, error: webhookError } = await resend.webhooks.create({
    endpoint,
    events: ["email.received", "email.sent", "email.delivered", "email.bounced"],
  });

  if (webhookError || !webhook) {
    return NextResponse.json(
      {
        error:
          webhookError?.message ?? "Failed to register webhook with Resend",
      },
      { status: 502 }
    );
  }

  if (existing?.webhookId) {
    const oldResend = new Resend(decrypt(existing.encryptedApiKey));
    await oldResend.webhooks.remove(existing.webhookId).catch(() => {});
  }

  const connection = await prisma.resendConnection.upsert({
    where: { userId },
    create: {
      id: connectionId,
      userId,
      encryptedApiKey: encrypt(apiKey),
      webhookId: webhook.id,
      encryptedWebhookSecret: encrypt(webhook.signing_secret),
    },
    update: {
      encryptedApiKey: encrypt(apiKey),
      webhookId: webhook.id,
      encryptedWebhookSecret: encrypt(webhook.signing_secret),
    },
  });

  return NextResponse.json({ connected: true, id: connection.id });
}
