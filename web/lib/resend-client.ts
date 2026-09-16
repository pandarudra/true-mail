import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function getConnectionForUser(userId: string) {
  const connection = await prisma.resendConnection.findUnique({
    where: { userId },
  });
  if (!connection) return null;
  const apiKey = decrypt(connection.encryptedApiKey);
  return { connection, resend: new Resend(apiKey) };
}

export async function getConnectionById(connectionId: string) {
  const connection = await prisma.resendConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) return null;
  const apiKey = decrypt(connection.encryptedApiKey);
  const webhookSecret = decrypt(connection.encryptedWebhookSecret);
  return { connection, resend: new Resend(apiKey), webhookSecret };
}
