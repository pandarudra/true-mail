import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { gmailOAuthUrl } from "@/lib/gmail";
import { randomBytes } from "crypto";

export async function GET() {
  const userId = await getUserId(await headers());
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const state = randomBytes(16).toString("hex");

  const res = NextResponse.redirect(gmailOAuthUrl(state));
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
