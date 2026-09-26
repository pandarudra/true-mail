import { NextResponse } from "next/server";
import { getUserIdForChat } from "@/lib/telegram/auth";
import { routeMessage, routeCallback, type TelegramMessage, type TelegramCallbackQuery } from "@/lib/telegram/router";

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export async function POST(req: Request) {
  const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const update: TelegramUpdate = await req.json();

  try {
    if (update.message) {
      const chatId = String(update.message.chat.id);
      const userId = await getUserIdForChat(chatId);
      await routeMessage(userId, chatId, update.message);
    } else if (update.callback_query) {
      const chatId = update.callback_query.message?.chat.id;
      const userId = chatId ? await getUserIdForChat(String(chatId)) : null;
      await routeCallback(userId, update.callback_query);
    }
  } catch (err) {
    // Telegram retries non-200 responses — always ack so one bad update
    // (e.g. a downstream AI/DB blip) doesn't loop forever. Errors here are
    // already user-visible as an "AI unavailable" style reply where relevant;
    // this is a last-resort net for anything that slipped through.
    console.error("Telegram webhook handler error", err);
  }

  return NextResponse.json({ ok: true });
}
