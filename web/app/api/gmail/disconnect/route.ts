import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conn = await prisma.gmailConnection.findUnique({ where: { userId } });
  if (!conn) return NextResponse.json({ ok: true });

  // Deleting the mailbox cascades to emails and the connection itself
  await prisma.mailbox.delete({ where: { id: conn.mailboxId } });

  return NextResponse.json({ ok: true });
}
