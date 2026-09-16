import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConnectionById } from "@/lib/resend-client";
import { verifyWebhookEvent } from "@/lib/webhook";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const connectionResult = await getConnectionById(connectionId);
  if (!connectionResult) {
    return NextResponse.json({ error: "unknown connection" }, { status: 404 });
  }
  const { resend, webhookSecret } = connectionResult;

  const payload = await req.text();
  let event;
  try {
    event = verifyWebhookEvent(
      resend,
      payload,
      {
        "svix-id": req.headers.get("svix-id"),
        "svix-timestamp": req.headers.get("svix-timestamp"),
        "svix-signature": req.headers.get("svix-signature"),
      },
      webhookSecret
    );
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "email.received") {
    const { data: email } = await resend.emails.receiving.get(
      event.data.email_id
    );
    if (email) {
      const recipient = email.to.find(Boolean);
      const mailbox = recipient
        ? await prisma.mailbox.findUnique({ where: { address: recipient } })
        : null;
      if (mailbox) {
        const existing = await prisma.email.findFirst({
          where: { resendEmailId: event.data.email_id },
        });
        if (!existing) {
          await prisma.email.create({
            data: {
              mailboxId: mailbox.id,
              resendEmailId: event.data.email_id,
              direction: "in",
              from: email.from,
              to: email.to,
              cc: email.cc ?? [],
              subject: email.subject ?? "",
              text: email.text,
              html: email.html,
              status: "received",
              receivedAt: new Date(),
            },
          });
        }
      }
    }
  } else if (
    event.type === "email.sent" ||
    event.type === "email.delivered" ||
    event.type === "email.bounced"
  ) {
    const status = event.type.replace("email.", "");
    await prisma.email.updateMany({
      where: { resendEmailId: event.data.email_id },
      data: { status },
    });
  }

  return NextResponse.json({ ok: true });
}
