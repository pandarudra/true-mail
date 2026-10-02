import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conn = await prisma.gmailConnection.findUnique({ where: { userId } });
  if (!conn) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    gmailEmail: conn.gmailEmail,
    lastSyncedAt: conn.lastSyncedAt,
  });
}
