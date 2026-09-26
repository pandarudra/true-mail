import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const TOKEN_TTL_MS = 10 * 60 * 1000;

export async function createLinkToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(9).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.telegramLinkToken.create({ data: { userId, token, expiresAt } });
  return { token, expiresAt };
}

type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "telegram_taken" };

export async function consumeLinkToken(
  token: string,
  telegram: { userId: string; chatId: string; username?: string | null }
): Promise<ConsumeResult> {
  const record = await prisma.telegramLinkToken.findUnique({ where: { token } });
  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };

  // This Telegram account is already linked to a *different* TrueMail user —
  // reject before the upsert below, which would otherwise hit the unique
  // constraint on telegramUserId and throw.
  const existingForTelegramUser = await prisma.telegramConnection.findUnique({
    where: { telegramUserId: telegram.userId },
  });
  if (existingForTelegramUser && existingForTelegramUser.userId !== record.userId) {
    return { ok: false, reason: "telegram_taken" };
  }

  // Atomic claim: only succeeds if still unused, closing the race between
  // two /start requests racing to consume the same token.
  const claimed = await prisma.telegramLinkToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, reason: "used" };

  await prisma.telegramConnection.upsert({
    where: { userId: record.userId },
    create: {
      userId: record.userId,
      telegramUserId: telegram.userId,
      telegramChatId: telegram.chatId,
      username: telegram.username ?? null,
    },
    update: {
      telegramUserId: telegram.userId,
      telegramChatId: telegram.chatId,
      username: telegram.username ?? null,
      lastInteractionAt: new Date(),
    },
  });

  return { ok: true, userId: record.userId };
}

export async function getUserIdForChat(chatId: string): Promise<string | null> {
  const connection = await prisma.telegramConnection.findUnique({ where: { telegramChatId: chatId } });
  if (!connection) return null;
  // Bookkeeping only — never block resolving the user on this write failing.
  prisma.telegramConnection
    .update({ where: { id: connection.id }, data: { lastInteractionAt: new Date() } })
    .catch(() => {});
  return connection.userId;
}

export async function getConnection(userId: string) {
  return prisma.telegramConnection.findUnique({ where: { userId } });
}

export async function disconnect(userId: string): Promise<boolean> {
  const result = await prisma.telegramConnection.deleteMany({ where: { userId } });
  return result.count > 0;
}
