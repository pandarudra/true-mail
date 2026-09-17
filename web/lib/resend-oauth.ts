import { createHash, randomBytes } from "crypto";

const AUTHORIZE_URL = "https://api.resend.com/oauth/authorize";
const TOKEN_URL = "https://api.resend.com/oauth/token";

export type ResendTokens = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

export function generatePkce() {
  const codeVerifier = base64url(randomBytes(64));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const state = base64url(randomBytes(24));
  return { codeVerifier, codeChallenge, state };
}

// The OAuth callback is a browser redirect, so unlike RESEND_WEBHOOK_BASE_URL
// (which Resend's servers must reach) this can be localhost in development.
export function getRedirectUri(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not set");
  return `${appUrl}/api/oauth/resend/callback`;
}

function getClientCredentials() {
  const clientId = process.env.RESEND_OAUTH_CLIENT_ID;
  const clientSecret = process.env.RESEND_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "RESEND_OAUTH_CLIENT_ID / RESEND_OAUTH_CLIENT_SECRET are not set — run `node scripts/register-resend-oauth-client.mjs` once and copy the output into .env"
    );
  }
  return { clientId, clientSecret };
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function buildAuthorizeUrl(params: { state: string; codeChallenge: string }): string {
  const { clientId } = getClientCredentials();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("scope", "full_access");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function postToken(body: URLSearchParams): Promise<ResendTokens> {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error_description ?? json?.error ?? "Resend OAuth token request failed");
  }
  return json;
}

export function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<ResendTokens> {
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
    })
  );
}

export function refreshAccessToken(refreshToken: string): Promise<ResendTokens> {
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}
