import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/lib/session";
import { generatePkce, buildAuthorizeUrl } from "@/lib/resend-oauth";
import { PKCE_COOKIE } from "@/lib/resend-oauth-cookie";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  let authorizeUrl: string;
  const { codeVerifier, codeChallenge, state } = generatePkce();
  try {
    authorizeUrl = buildAuthorizeUrl({ state, codeChallenge });
  } catch {
    return NextResponse.redirect(new URL("/onboarding/resend?error=oauth_not_configured", req.url));
  }

  const cookieStore = await cookies();
  cookieStore.set(PKCE_COOKIE, JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/oauth/resend",
  });

  return NextResponse.redirect(authorizeUrl);
}
