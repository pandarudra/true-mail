import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mailboxId = url.searchParams.get("mailboxId");
  const direction = url.searchParams.get("direction");
  if (!mailboxId) {
    return NextResponse.json({ error: "mailboxId is required" }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, userId },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const emails = await prisma.email.findMany({
    where: {
      mailboxId,
      ...(direction ? { direction } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ emails });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const mailboxId: string | undefined = body?.mailboxId;
  const to: string[] | undefined = body?.to;
  const subject: string | undefined = body?.subject;
  const text: string | undefined = body?.text;
  const html: string | undefined = body?.html;
  const cc: string[] = body?.cc ?? [];

  if (!mailboxId || !to?.length || !subject || !text) {
    return NextResponse.json(
      { error: "mailboxId, to, subject, and text are required" },
      { status: 400 }
    );
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, userId },
    include: { domain: true },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (mailbox.domain.status !== "verified") {
    return NextResponse.json(
      { error: "domain is not verified" },
      { status: 400 }
    );
  }

  const connectionResult = await getConnectionForUser(userId);
  if (!connectionResult) {
    return NextResponse.json({ error: "no Resend connection" }, { status: 400 });
  }
  const { resend } = connectionResult;

  const sendId = randomUUID();
  const { data, error } = await resend.emails.send(
    {
      from: mailbox.address,
      to,
      cc,
      subject,
      text,
      html,
    },
    { idempotencyKey: `send/${sendId}` }
  );

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to send email" },
      { status: 502 }
    );
  }

  const email = await prisma.email.create({
    data: {
      id: sendId,
      mailboxId,
      resendEmailId: data.id,
      direction: "out",
      from: mailbox.address,
      to,
      cc,
      subject,
      text,
      html,
      status: "sent",
      sentAt: new Date(),
    },
  });

  return NextResponse.json({ email });
}
