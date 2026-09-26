import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { askInbox } from "@/lib/ai/ask-inbox";

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const mailboxId: string | undefined = body?.mailboxId;
  const question: string | undefined = body?.question;
  if (!mailboxId || !question?.trim()) {
    return NextResponse.json({ error: "mailboxId and question are required" }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId, userId } });
  if (!mailbox) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const result = await askInbox(mailboxId, question);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
