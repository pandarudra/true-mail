import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";
import { sendEmail } from "@/lib/resend";
import { folderWhere, isFolderId } from "@/lib/mail-folders";

const MUTABLE_FIELDS = ["read", "starred", "important", "archived", "spam"] as const;

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mailboxId = url.searchParams.get("mailboxId");
  const folder = url.searchParams.get("folder") ?? "inbox";
  if (!mailboxId) {
    return NextResponse.json({ error: "mailboxId is required" }, { status: 400 });
  }
  if (!isFolderId(folder)) {
    return NextResponse.json({ error: "invalid folder" }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, userId },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const emails = await prisma.email.findMany({
    where: { mailboxId, ...folderWhere(folder) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ emails });
}

// Bulk flag update (mark read, star, archive, spam, important) for a set of
// emails at once — used by the inbox toolbar's bulk actions.
export async function PATCH(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids: string[] | undefined = body?.ids;
  const trashed: boolean | undefined = body?.trashed;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  const data: Record<string, boolean | Date | null> = {};
  for (const field of MUTABLE_FIELDS) {
    if (typeof body?.[field] === "boolean") data[field] = body[field];
  }
  if (typeof trashed === "boolean") {
    data.trashedAt = trashed ? new Date() : null;
  }

  const { count } = await prisma.email.updateMany({
    where: { id: { in: ids }, mailbox: { userId } },
    data,
  });

  return NextResponse.json({ updated: count });
}

// Bulk permanent delete — used by "Delete forever" and "Empty trash".
export async function DELETE(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids: string[] | undefined = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  const { count } = await prisma.email.deleteMany({
    where: { id: { in: ids }, mailbox: { userId } },
  });

  return NextResponse.json({ deleted: count });
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
  const sendResult = await sendEmail(
    resend,
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

  const data = sendResult?.data;
  if (!data) {
    return NextResponse.json(
      { error: "Failed to send email" },
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
