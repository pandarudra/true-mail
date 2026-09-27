import { getConnection } from "@/lib/telegram/auth";
import { sendMessage, type InlineButton } from "@/lib/telegram/api";
import { escapeMarkdown, bold } from "@/lib/telegram/format";

export type NotificationButton = { label: string; callbackData: string };

export type NotificationInput = {
  userId: string;
  title: string;
  body: string;
  buttons?: NotificationButton[][];
};

// Channel-independent by design (spec: "the Task system must not know how
// Telegram or SMS works") — callers depend on this function, never on
// lib/telegram directly. Only Telegram is wired up today; a future Web
// Push/SMS channel plugs in here without any caller changing.
export async function sendNotification(input: NotificationInput): Promise<boolean> {
  const connection = await getConnection(input.userId);
  if (!connection) return false; // no channel connected — nothing to deliver to

  const text = `${bold(input.title)}\n\n${escapeMarkdown(input.body)}`;
  const buttons: InlineButton[][] | undefined = input.buttons?.map((row) =>
    row.map((b) => ({ text: b.label, callback_data: b.callbackData }))
  );

  try {
    await sendMessage(connection.telegramChatId, text, { buttons });
    return true;
  } catch (err) {
    console.error("sendNotification failed", err);
    return false;
  }
}
