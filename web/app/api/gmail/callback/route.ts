import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { getUserId } from "@/lib/session";
import {
  exchangeGmailCode,
  getGmailProfile,
  storeGmailTokens,
} from "@/lib/gmail";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const userId = await getUserId(await headers());
  if (!userId) return NextResponse.redirect(new URL("/settings", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const savedState = jar.get("gmail_oauth_state")?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/settings?gmail=error", req.url));
  }

  try {
    const { accessToken, refreshToken, expiresAt } = await exchangeGmailCode(code);
    const { emailAddress } = await getGmailProfile(accessToken);

    // Create or reuse a Gmail mailbox (no domain)
    const existing = await prisma.gmailConnection.findUnique({ where: { userId } });
    let mailboxId: string;

    if (existing) {
      mailboxId = existing.mailboxId;
    } else {
      const mailbox = await prisma.mailbox.create({
        data: {
          userId,
          localPart: emailAddress.split("@")[0],
          address: emailAddress,
          displayName: emailAddress,
          source: "gmail",
          isDefault: false,
        },
      });
      mailboxId = mailbox.id;
    }

    await storeGmailTokens(userId, mailboxId, emailAddress, accessToken, refreshToken, expiresAt);

    const res = NextResponse.redirect(new URL("/settings?gmail=connected", req.url));
    res.cookies.delete("gmail_oauth_state");
    return res;
  } catch {
    return NextResponse.redirect(new URL("/settings?gmail=error", req.url));
  }
}
