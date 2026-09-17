import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { getUserId } from "@/lib/session";
import { exchangeCodeForTokens } from "@/lib/resend-oauth";
import { PKCE_COOKIE } from "@/lib/resend-oauth-cookie";
import { createWebhook, deleteWebhook } from "@/lib/resend";

function errorRedirect(req: Request, code: string) {
  return NextResponse.redirect(new URL(`/onboarding/resend?error=${code}`, req.url));
}

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const cookieStore = await cookies();
  const pkceCookie = cookieStore.get(PKCE_COOKIE)?.value;
  cookieStore.delete(PKCE_COOKIE);

  const url = new URL(req.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return errorRedirect(req, oauthError);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !pkceCookie) {
    return errorRedirect(req, "invalid_callback");
  }

  let stored: { state: string; codeVerifier: string };
  try {
    stored = JSON.parse(pkceCookie);
  } catch {
    return errorRedirect(req, "invalid_callback");
  }
  if (stored.state !== state) {
    return errorRedirect(req, "state_mismatch");
  }

  const webhookBaseUrl = process.env.RESEND_WEBHOOK_BASE_URL ?? process.env.APP_URL;
  if (!webhookBaseUrl?.startsWith("https://")) {
    return errorRedirect(req, "webhook_base_url_not_https");
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, stored.codeVerifier);
  } catch {
    return errorRedirect(req, "token_exchange_failed");
  }

  const resend = new Resend(tokens.access_token);
  const existing = await prisma.resendConnection.findUnique({ where: { userId } });
  const connectionId = existing?.id ?? randomUUID();

  // Reconnecting (e.g. re-authorizing) must not disturb existing Domains/
  // Mailboxes — they cascade off ResendConnection.id, so we upsert in place
  // rather than delete-then-create. The new webhook is verified working
  // before any database write, so a failed reconnect never corrupts a
  // previously-working connection.
  const endpoint = `${webhookBaseUrl}/api/webhooks/resend/${connectionId}`;
  const webhookResult = await createWebhook(resend, {
    endpoint,
    events: ["email.received", "email.sent", "email.delivered", "email.bounced"],
  });
  if (!webhookResult?.data) {
    return errorRedirect(req, "webhook_registration_failed");
  }

  if (existing?.webhookId) {
    const oldResend = new Resend(decrypt(existing.encryptedAccessToken));
    await deleteWebhook(oldResend, existing.webhookId);
  }

  const tokenFields = {
    encryptedAccessToken: encrypt(tokens.access_token),
    encryptedRefreshToken: encrypt(tokens.refresh_token),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope,
    webhookId: webhookResult.data.id,
    encryptedWebhookSecret: encrypt(webhookResult.data.signing_secret),
  };

  await prisma.resendConnection.upsert({
    where: { userId },
    create: { id: connectionId, userId, ...tokenFields },
    update: tokenFields,
  });

  return NextResponse.redirect(new URL("/onboarding/domain", req.url));
}
