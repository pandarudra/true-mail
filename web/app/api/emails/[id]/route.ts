import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { attachmentsCreateData } from "@/lib/attachments";

async function loadOwnedEmail(id: string, userId: string) {
  return prisma.email.findFirst({
    where: { id, mailbox: { userId } },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const email = await loadOwnedEmail(id, userId);
  if (!email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ email });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedEmail(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: {
    read?: boolean;
    starred?: boolean;
    important?: boolean;
    archived?: boolean;
    spam?: boolean;
    trashedAt?: Date | null;
    mailboxId?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    subject?: string;
    text?: string;
  } = {};
  if (typeof body?.read === "boolean") data.read = body.read;
  if (typeof body?.starred === "boolean") data.starred = body.starred;
  if (typeof body?.important === "boolean") data.important = body.important;
  if (typeof body?.archived === "boolean") data.archived = body.archived;
  if (typeof body?.spam === "boolean") data.spam = body.spam;
  if (typeof body?.trashed === "boolean") data.trashedAt = body.trashed ? new Date() : null;

  // Content edits (to/cc/subject/text/mailbox/attachments) are autosave
  // writes from the compose form — only ever valid while the email is still
  // a draft, so a sent email's content can't be rewritten through this
  // endpoint.
  let replaceAttachments = false;
  if (existing.status === "draft") {
    if (Array.isArray(body?.to)) data.to = body.to;
    if (Array.isArray(body?.cc)) data.cc = body.cc;
    if (typeof body?.subject === "string") data.subject = body.subject;
    if (typeof body?.text === "string") data.text = body.text;
    if (Array.isArray(body?.attachments)) replaceAttachments = true;
    if (typeof body?.mailboxId === "string") {
      const mailbox = await prisma.mailbox.findFirst({
        where: { id: body.mailboxId, userId },
      });
      if (!mailbox) {
        return NextResponse.json({ error: "mailbox not found" }, { status: 404 });
      }
      data.mailboxId = mailbox.id;
      data.from = mailbox.address;
    }
  }

  const email = await prisma.email.update({
    where: { id },
    data: {
      ...data,
      ...(replaceAttachments && {
        attachments: { deleteMany: {}, create: attachmentsCreateData(body.attachments) },
      }),
    },
    include: { attachments: true },
  });
  return NextResponse.json({ email });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedEmail(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.email.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
