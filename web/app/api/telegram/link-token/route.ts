import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { createLinkToken } from "@/lib/telegram/auth";

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json({ error: "Telegram isn't configured on this server" }, { status: 503 });
  }

  const { token, expiresAt } = await createLinkToken(userId);
  return NextResponse.json({
    deepLink: `https://t.me/${botUsername}?start=${token}`,
    expiresAt,
  });
}
