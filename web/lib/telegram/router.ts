import { classifyIntent } from "@/lib/telegram/intent";
import * as handlers from "@/lib/telegram/handlers";
import { sendMessage } from "@/lib/telegram/api";
import { settingsDeepLink } from "@/lib/telegram/format";

export type TelegramMessage = {
  message_id: number;
  from: { id: number; username?: string };
  chat: { id: number };
  text?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  from: { id: number };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
};

// Reply-keyboard button taps arrive as plain text matching the label —
// mapped straight to a handler, bypassing the AI classifier.
const MENU_SHORTCUTS: Record<string, (userId: string, chatId: string) => Promise<void>> = {
  "☀️ My Day": handlers.handleDailySummary,
  "📬 Inbox": handlers.handleEmailSummary,
  "📋 Tasks": handlers.handleListTasks,
  "🎯 Goal": handlers.handleGoalToday,
  "📅 Calendar": handlers.handleCalendarToday,
};

const SLASH_COMMANDS: Record<string, (userId: string, chatId: string, arg: string) => Promise<void>> = {
  "/today": handlers.handleDailySummary,
  "/tasks": handlers.handleListTasks,
  "/summary": handlers.handleEmailSummary,
  "/calendar": handlers.handleCalendarToday,
  "/goal": handlers.handleGoalToday,
  "/create": (userId, chatId, arg) => handlers.handleCreateTask(userId, chatId, arg),
  "/done": (userId, chatId, arg) => handlers.handleCompleteTaskQuery(userId, chatId, arg),
  "/settings": handlers.handleSettings,
};

export async function routeMessage(userId: string | null, chatId: string, message: TelegramMessage) {
  const text = message.text?.trim() ?? "";

  if (text.startsWith("/start")) {
    await handlers.handleStart(chatId, message.from, text.split(/\s+/)[1]);
    return;
  }

  if (!userId) {
    await sendMessage(chatId, "🔗 Your Telegram account isn't connected to TrueMail\\.", {
      buttons: [[{ text: "Connect TrueMail", url: settingsDeepLink() }]],
    });
    return;
  }

  if (text === "/help") {
    await handlers.handleHelp(chatId);
    return;
  }
  if (text === "/disconnect") {
    await handlers.handleDisconnectPrompt(chatId);
    return;
  }
  if (text === "🤖 Ask TrueMail") {
    await sendMessage(chatId, "Ask me anything about your inbox, e.g. \"What did Arjun say about the project?\"");
    return;
  }

  const shortcut = MENU_SHORTCUTS[text];
  if (shortcut) {
    await shortcut(userId, chatId);
    return;
  }

  const spaceIdx = text.indexOf(" ");
  const command = spaceIdx === -1 ? text : text.slice(0, spaceIdx);
  const arg = spaceIdx === -1 ? "" : text.slice(spaceIdx + 1).trim();
  const handler = SLASH_COMMANDS[command];
  if (handler) {
    await handler(userId, chatId, arg);
    return;
  }

  if (!text) return;
  const { intent } = await classifyIntent(text);
  switch (intent) {
    case "daily_summary":
      return handlers.handleDailySummary(userId, chatId);
    case "list_tasks":
      return handlers.handleListTasks(userId, chatId);
    case "create_task":
      return handlers.handleCreateTask(userId, chatId, text);
    case "complete_task":
      return handlers.handleCompleteTaskQuery(userId, chatId, text);
    case "email_summary":
      return handlers.handleEmailSummary(userId, chatId);
    case "calendar_today":
      return handlers.handleCalendarToday(userId, chatId);
    case "goal_today":
      return handlers.handleGoalToday(userId, chatId);
    case "ask_inbox":
      return handlers.handleAskInbox(userId, chatId, text);
    default:
      return handlers.handleUnknown(chatId);
  }
}

export async function routeCallback(userId: string | null, callback: TelegramCallbackQuery) {
  const chatId = callback.message?.chat.id;
  const messageId = callback.message?.message_id;
  if (!userId || !chatId || !messageId || !callback.data) return;
  await handlers.handleCallback(userId, String(chatId), callback.id, messageId, callback.data);
}
