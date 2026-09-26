import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { getConnection } from "@/lib/telegram/auth";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connection = await getConnection(userId);
  return NextResponse.json({
    connected: !!connection,
    username: connection?.username ?? null,
    connectedAt: connection?.connectedAt ?? null,
  });
}
