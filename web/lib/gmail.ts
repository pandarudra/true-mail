import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

const REFRESH_BUFFER_MS = 60_000;
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${process.env.APP_URL}/api/gmail/callback`,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGmailCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${process.env.APP_URL}/api/gmail/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token exchange failed: ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshGmailToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getGmailAccessToken(userId: string): Promise<string | null> {
  const conn = await prisma.gmailConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  if (conn.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS) {
    return decrypt(conn.encryptedAccessToken);
  }

  const { accessToken, expiresAt } = await refreshGmailToken(decrypt(conn.encryptedRefreshToken));
  await prisma.gmailConnection.update({
    where: { userId },
    data: { encryptedAccessToken: encrypt(accessToken), accessTokenExpiresAt: expiresAt },
  });
  return accessToken;
}

export async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail profile failed: ${res.status}`);
  return res.json() as Promise<{ emailAddress: string }>;
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType: string;
  body: { data?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  payload: { headers: GmailHeader[]; body: { data?: string }; parts?: GmailPart[] };
  internalDate: string;
};

function header(msg: GmailMessage, name: string): string {
  return msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function b64Decode(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(part: GmailPart, mime: string): string | null {
  if (part.mimeType === mime && part.body.data) return b64Decode(part.body.data);
  if (part.parts) {
    for (const p of part.parts) {
      const found = extractBody(p, mime);
      if (found) return found;
    }
  }
  return null;
}

export function parseGmailMessage(msg: GmailMessage): {
  gmailMessageId: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  receivedAt: Date;
} {
  const rootPart: GmailPart = {
    mimeType: "multipart/mixed",
    body: msg.payload.body,
    parts: msg.payload.parts,
  };

  // For single-part messages, the body is on the payload itself
  const text =
    extractBody(rootPart, "text/plain") ??
    (msg.payload.body.data ? b64Decode(msg.payload.body.data) : null);
  const html = extractBody(rootPart, "text/html");

  return {
    gmailMessageId: msg.id,
    from: header(msg, "from"),
    to: header(msg, "to")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    subject: header(msg, "subject"),
    text,
    html,
    receivedAt: new Date(Number(msg.internalDate)),
  };
}

export async function fetchGmailMessages(
  accessToken: string,
  maxResults = 50,
  pageToken?: string
): Promise<{ messages: Array<{ id: string }>; nextPageToken?: string }> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    labelIds: "INBOX",
    ...(pageToken ? { pageToken } : {}),
  });
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Gmail list failed: ${res.status}`);
  return res.json() as Promise<{ messages: Array<{ id: string }>; nextPageToken?: string }>;
}

export async function fetchGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Gmail get message failed: ${res.status}`);
  return res.json() as Promise<GmailMessage>;
}

export async function storeGmailTokens(
  userId: string,
  mailboxId: string,
  gmailEmail: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
) {
  await prisma.gmailConnection.upsert({
    where: { userId },
    create: {
      userId,
      mailboxId,
      gmailEmail,
      encryptedAccessToken: encrypt(accessToken),
      encryptedRefreshToken: encrypt(refreshToken),
      accessTokenExpiresAt: expiresAt,
    },
    update: {
      mailboxId,
      gmailEmail,
      encryptedAccessToken: encrypt(accessToken),
      encryptedRefreshToken: encrypt(refreshToken),
      accessTokenExpiresAt: expiresAt,
    },
  });
}
