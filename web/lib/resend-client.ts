import { Resend } from "resend";
import type { ResendConnection } from "../generated/prisma/client";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/resend-oauth";

// Access tokens live 900 seconds; refresh a bit early so a slow request
// doesn't get a token that expires mid-flight.
const REFRESH_BUFFER_MS = 60_000;

// ponytail: refreshes aren't locked across concurrent requests for the same
// connection — a rare race could fire two refreshes at once, and since
// refresh tokens rotate on use, the loser's write would be stale. Add a
// per-connection advisory lock if that starts happening in practice.
async function resolveAccessToken(connection: ResendConnection) {
  if (connection.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS) {
    return { accessToken: decrypt(connection.encryptedAccessToken), connection };
  }

  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const tokens = await refreshAccessToken(refreshToken);
  const updated = await prisma.resendConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encrypt(tokens.access_token),
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    },
  });
  return { accessToken: tokens.access_token, connection: updated };
}

export async function getConnectionForUser(userId: string) {
  const connection = await prisma.resendConnection.findUnique({ where: { userId } });
  if (!connection) return null;
  const { accessToken, connection: fresh } = await resolveAccessToken(connection);
  return { connection: fresh, resend: new Resend(accessToken) };
}

export async function getConnectionById(connectionId: string) {
  const connection = await prisma.resendConnection.findUnique({ where: { id: connectionId } });
  if (!connection) return null;
  const { accessToken, connection: fresh } = await resolveAccessToken(connection);
  const webhookSecret = decrypt(fresh.encryptedWebhookSecret);
  return { connection: fresh, resend: new Resend(accessToken), webhookSecret };
}
