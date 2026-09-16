import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
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

  const resend = new Resend(apiKey);
  const { error: validateError } = await resend.domains.list();
  if (validateError) {
    return NextResponse.json(
      { error: "Invalid Resend API key" },
      { status: 400 }
    );
  }

  const connection = await prisma.resendConnection.create({
    data: {
      userId,
      encryptedApiKey: encrypt(apiKey),
      webhookId: "",
      encryptedWebhookSecret: "",
    },
  });

  const endpoint = `${process.env.APP_URL}/api/webhooks/resend/${connection.id}`;
  const { data: webhook, error: webhookError } = await resend.webhooks.create({
    endpoint,
    events: ["email.received", "email.sent", "email.delivered", "email.bounced"],
  });

  if (webhookError || !webhook) {
    await prisma.resendConnection.delete({ where: { id: connection.id } });
    return NextResponse.json(
      { error: "Failed to register webhook with Resend" },
      { status: 502 }
    );
  }

  await prisma.resendConnection.update({
    where: { id: connection.id },
    data: {
      webhookId: webhook.id,
      encryptedWebhookSecret: encrypt(webhook.signing_secret),
    },
  });

  return NextResponse.json({ connected: true, id: connection.id });
}
