import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  getGmailAccessToken,
  fetchGmailMessages,
  fetchGmailMessage,
  parseGmailMessage,
} from "@/lib/gmail";

const SYNC_BATCH = 25; // messages per sync run

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conn = await prisma.gmailConnection.findUnique({ where: { userId } });
  if (!conn) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  const accessToken = await getGmailAccessToken(userId);
  if (!accessToken) return NextResponse.json({ error: "Could not get Gmail token" }, { status: 500 });

  const { messages } = await fetchGmailMessages(accessToken, SYNC_BATCH);
  if (!messages?.length) {
    return NextResponse.json({ synced: 0 });
  }

  // Find which message IDs are already in the DB
  const ids = messages.map((m) => m.id);
  const existing = await prisma.email.findMany({
    where: { gmailMessageId: { in: ids } },
    select: { gmailMessageId: true },
  });
  const existingIds = new Set(existing.map((e) => e.gmailMessageId));
  const newIds = ids.filter((id) => !existingIds.has(id));

  let synced = 0;
  for (const id of newIds) {
    try {
      const raw = await fetchGmailMessage(accessToken, id);
      const parsed = parseGmailMessage(raw);

      await prisma.email.create({
        data: {
          mailboxId: conn.mailboxId,
          gmailMessageId: parsed.gmailMessageId,
          from: parsed.from,
          to: parsed.to,
          cc: [],
          subject: parsed.subject,
          text: parsed.text,
          html: parsed.html,
          direction: "INCOMING",
          status: "RECEIVED",
          read: false,
          receivedAt: parsed.receivedAt,
          createdAt: parsed.receivedAt,
        },
      });
      synced++;
    } catch {
      // skip malformed messages — don't abort the whole sync
    }
  }

  await prisma.gmailConnection.update({
    where: { userId },
    data: { lastSyncedAt: new Date() },
  });

  return NextResponse.json({ synced, total: newIds.length });
}
