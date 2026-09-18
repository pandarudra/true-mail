import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { attachmentsCreateData } from "@/lib/attachments";

// Creates an empty or partial draft. Content is filled in afterwards via
// PATCH /api/emails/[id] as the user types (autosave).
export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const mailboxId: string | undefined = body?.mailboxId;
  if (!mailboxId) {
    return NextResponse.json({ error: "mailboxId is required" }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId, userId } });
  if (!mailbox) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const email = await prisma.email.create({
    data: {
      mailboxId,
      direction: "out",
      status: "draft",
      from: mailbox.address,
      to: Array.isArray(body?.to) ? body.to : [],
      cc: Array.isArray(body?.cc) ? body.cc : [],
      subject: typeof body?.subject === "string" ? body.subject : "",
      text: typeof body?.text === "string" ? body.text : "",
      attachments: { create: attachmentsCreateData(body?.attachments) },
    },
    include: { attachments: true },
  });

  return NextResponse.json({ email });
}
