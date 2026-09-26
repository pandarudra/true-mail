const TELEGRAM_API_BASE = "https://api.telegram.org";

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

async function call(method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(`Telegram API ${method} failed: ${JSON.stringify(json)}`);
  }
  return json.result;
}

export type InlineButton = { text: string; callback_data?: string; url?: string };

export async function sendMessage(
  chatId: string,
  text: string,
  opts: { buttons?: InlineButton[][]; keyboard?: string[][] } = {}
): Promise<void> {
  const reply_markup = opts.buttons
    ? { inline_keyboard: opts.buttons }
    : opts.keyboard
      ? { keyboard: opts.keyboard.map((row) => row.map((text) => ({ text }))), resize_keyboard: true }
      : undefined;
  await call("sendMessage", { chat_id: chatId, text, parse_mode: "MarkdownV2", reply_markup });
}

export async function editMessageText(
  chatId: string,
  messageId: number,
  text: string,
  opts: { buttons?: InlineButton[][] } = {}
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "MarkdownV2",
    reply_markup: opts.buttons ? { inline_keyboard: opts.buttons } : undefined,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function setMyCommands(commands: { command: string; description: string }[]): Promise<void> {
  await call("setMyCommands", { commands });
}

export async function setWebhook(url: string, secretToken: string): Promise<void> {
  await call("setWebhook", { url, secret_token: secretToken });
}
