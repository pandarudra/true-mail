import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConnectionById } from "@/lib/resend-client";
import { verifyWebhookEvent } from "@/lib/webhook";
import { getReceivedEmail } from "@/lib/resend";

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
    const emailResult = await getReceivedEmail(resend, event.data.email_id);
    const email = emailResult?.data;
    // Couldn't fetch the email body from Resend (rate limit, transient token
    // issue, etc) — fail loudly so Resend retries this event instead of
    // silently losing the message. A missing mailbox match, below, is a
    // legitimate no-op and stays a 200.
    if (!email) {
      console.error("Failed to fetch received email", event.data.email_id);
      return NextResponse.json(
        { error: "Failed to fetch email from Resend" },
        { status: 502 }
      );
    }

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
            attachments: {
              create: email.attachments.map((a) => ({
                filename: a.filename ?? "attachment",
                contentType: a.content_type,
                size: a.size,
                resendAttachmentId: a.id,
              })),
            },
          },
        });
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
