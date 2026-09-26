import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { disconnect } from "@/lib/telegram/auth";

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await disconnect(userId);
  return NextResponse.json({ ok: true });
}
