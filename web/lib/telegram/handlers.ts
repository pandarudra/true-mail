import { prisma } from "@/lib/db";
import { sendMessage, answerCallbackQuery, editMessageText, type InlineButton } from "@/lib/telegram/api";
import { consumeLinkToken, disconnect, getConnection } from "@/lib/telegram/auth";
import {
  escapeMarkdown,
  bold,
  emailDeepLink,
  tasksDeepLink,
  calendarDeepLink,
  settingsDeepLink,
  formatDueDate,
} from "@/lib/telegram/format";
import { getDailySummary, getTaskBuckets, getEmailSummary, getTodayHolidays, type TaskSummary } from "@/lib/telegram/summary";
import { createTaskForUser, ownsTask } from "@/lib/tasks";
import { parseTaskFromText } from "@/lib/ai/parse-task";
import { summarizeEmail } from "@/lib/ai/summarize-email";
import { askInbox } from "@/lib/ai/ask-inbox";
import { getDefaultMailbox } from "@/lib/telegram/summary";
import { chatText } from "@/lib/ai/nvidia";

export const MAIN_MENU_KEYBOARD = [
  ["☀️ My Day", "📬 Inbox"],
  ["📋 Tasks", "🎯 Goal"],
  ["📅 Calendar", "🤖 Ask TrueMail"],
];

function urlButton(text: string, url: string): InlineButton {
  return { text, url };
}

// ---- Linking ----

export async function handleStart(chatId: string, from: { id: number; username?: string }, token?: string) {
  if (!token) {
    const alreadyConnected = await prisma.telegramConnection.findUnique({ where: { telegramChatId: chatId } });
    if (alreadyConnected) {
      await sendWelcome(chatId);
    } else {
      await sendMessage(chatId, "🔗 Connect your Telegram account to TrueMail first — open Settings and tap *Connect Telegram*\\.", {
        buttons: [[urlButton("Open Settings", settingsDeepLink())]],
      });
    }
    return;
  }

  const result = await consumeLinkToken(token, { userId: String(from.id), chatId, username: from.username ?? null });
  if (!result.ok) {
    const reason: Record<string, string> = {
      invalid: "That link isn't valid\\. Generate a new one from TrueMail Settings\\.",
      expired: "That link expired\\. Generate a new one from TrueMail Settings — links last 10 minutes\\.",
      used: "That link was already used\\. Generate a new one from TrueMail Settings if you still need to connect\\.",
      telegram_taken: "This Telegram account is already connected to a different TrueMail account\\. Disconnect it there first\\.",
    };
    await sendMessage(chatId, reason[result.reason], { buttons: [[urlButton("Open Settings", settingsDeepLink())]] });
    return;
  }
  await sendMessage(chatId, "✅ Telegram connected to your TrueMail account\\!");
  await sendWelcome(chatId);
}

async function sendWelcome(chatId: string) {
  await sendMessage(
    chatId,
    `👋 ${bold("Welcome to TrueMail")}\n\nI'm your TrueMail productivity assistant\\. I can help with email, tasks, goals, calendar, and daily planning\\.\n\nTry "Give me my day" or use the buttons below\\.`,
    { keyboard: MAIN_MENU_KEYBOARD }
  );
}

export async function handleHelp(chatId: string) {
  await sendMessage(
    chatId,
    [
      bold("Commands"),
      "/today — your daily summary",
      "/tasks — your task list",
      "/summary — email summary",
      "/calendar — today's calendar",
      "/create <task> — create a task",
      "/done — complete a task",
      "/goal — today's focus",
      "/settings — connection status",
      "/disconnect — unlink Telegram",
      "",
      "Or just ask in plain English — \"What's on my plate today?\", \"Create a task to call Rahul tomorrow\"\\.",
    ].join("\n")
  );
}

export async function handleSettings(userId: string, chatId: string) {
  const conn = await getConnection(userId);
  await sendMessage(
    chatId,
    conn
      ? `Connected as ${escapeMarkdown(conn.username ? `@${conn.username}` : "this Telegram account")} since ${escapeMarkdown(conn.connectedAt.toDateString())}\\.`
      : "Not connected\\."
  );
}

export async function handleDisconnectPrompt(chatId: string) {
  await sendMessage(chatId, "Disconnect Telegram from TrueMail? You'll stop receiving updates here\\.", {
    buttons: [[{ text: "Disconnect", callback_data: "disconnect_confirm" }, { text: "Cancel", callback_data: "disconnect_cancel" }]],
  });
}

// ---- Daily summary / goal / calendar ----

function taskLine(t: TaskSummary): string {
  const due = t.dueAt ? ` — ${escapeMarkdown(formatDueDate(t.dueAt, t.dueHasTime))}` : "";
  return `• ${escapeMarkdown(t.title)}${due}`;
}

export async function handleDailySummary(userId: string, chatId: string) {
  const { tasks, email, holidays } = await getDailySummary(userId);
  const lines: string[] = [`☀️ ${bold("Your Day")}`, ""];

  lines.push(`📬 ${bold("Inbox")}`);
  lines.push(`• ${email.unreadCount} unread`, `• ${email.importantEmails.length} important`, "");

  const taskCount = tasks.overdue.length + tasks.today.length;
  lines.push(`📋 ${bold("Tasks")}`);
  if (taskCount === 0) {
    lines.push("• Nothing due today 🎉");
  } else {
    tasks.overdue.forEach((t) => lines.push(`🔴 ${taskLine(t)}`));
    tasks.today.forEach((t) => lines.push(`🟠 ${taskLine(t)}`));
  }
  lines.push("");

  if (holidays.length > 0) {
    lines.push(`📅 ${bold("Today")}`);
    holidays.forEach((h) => lines.push(`• ${escapeMarkdown(h.name)}`));
  }

  await sendMessage(chatId, lines.join("\n"), { buttons: [[urlButton("Open TrueMail", tasksDeepLink())]] });
}

export async function handleCalendarToday(userId: string, chatId: string) {
  const [tasks, holidays] = await Promise.all([getTaskBuckets(userId), getTodayHolidays(userId)]);
  const lines = [`📅 ${bold("Today")}`, ""];
  if (tasks.today.length === 0 && holidays.length === 0) {
    lines.push("Nothing on your calendar today\\.");
  } else {
    tasks.today.forEach((t) => lines.push(taskLine(t)));
    holidays.forEach((h) => lines.push(`• ${escapeMarkdown(h.name)}`));
  }
  await sendMessage(chatId, lines.join("\n"), { buttons: [[urlButton("Open Calendar", calendarDeepLink())]] });
}

export async function handleGoalToday(userId: string, chatId: string) {
  const { tasks, email } = await getDailySummary(userId);
  const overdueTitles = tasks.overdue.map((t) => t.title);
  const todayTitles = tasks.today.map((t) => t.title);
  const fallbackTask = tasks.overdue[0] ?? tasks.today[0];
  if (!fallbackTask) {
    await sendMessage(chatId, `🎯 ${bold("Your Goal Today")}\n\nNothing urgent is due — a good day to get ahead on upcoming work\\.`);
    return;
  }
  try {
    const focus = await chatText({
      system:
        "Given a user's overdue tasks, tasks due today, and important email count, name the ONE thing " +
        "they should focus on today in a single short sentence (imperative, no preamble, no quotes).",
      user: JSON.stringify({ overdue: overdueTitles, today: todayTitles, importantEmails: email.importantEmails.length }),
      maxTokens: 60,
      temperature: 0.3,
    });
    await sendMessage(chatId, `🎯 ${bold("Your Goal Today")}\n\n${escapeMarkdown(focus.trim())}`, {
      buttons: [[urlButton("View Tasks", tasksDeepLink())]],
    });
  } catch {
    await sendMessage(chatId, `🎯 ${bold("Your Goal Today")}\n\n${taskLine(fallbackTask)}`);
  }
}

// ---- Tasks ----

export async function handleListTasks(userId: string, chatId: string) {
  const buckets = await getTaskBuckets(userId);
  const lines: string[] = [`📋 ${bold("Tasks")}`, ""];
  if (buckets.overdue.length === 0 && buckets.today.length === 0 && buckets.upcoming.length === 0) {
    lines.push("Nothing pending 🎉");
  } else {
    if (buckets.overdue.length) {
      lines.push(`🔴 ${bold("Overdue")}`, ...buckets.overdue.map(taskLine), "");
    }
    if (buckets.today.length) {
      lines.push(`🟠 ${bold("Today")}`, ...buckets.today.map(taskLine), "");
    }
    if (buckets.upcoming.length) {
      lines.push(`🔵 ${bold("Upcoming")}`, ...buckets.upcoming.map(taskLine));
    }
  }
  const all = [...buckets.overdue, ...buckets.today, ...buckets.upcoming].slice(0, 5);
  const buttons = all.map((t) => [{ text: `✅ ${t.title}`.slice(0, 60), callback_data: `complete:${t.id}` }]);
  await sendMessage(chatId, lines.join("\n"), { buttons: buttons.length ? buttons : undefined });
}

export async function handleCreateTask(userId: string, chatId: string, text: string) {
  if (!text.trim()) {
    await sendMessage(chatId, 'What should the task say? Try: "Create a task to send the proposal tomorrow at 10am"\\.');
    return;
  }
  try {
    const parsed = await parseTaskFromText(text, 0);
    const result = await createTaskForUser(userId, { title: parsed.title, dueAt: parsed.dueAt, dueHasTime: parsed.dueHasTime });
    if (!result.ok) {
      await sendMessage(chatId, `Couldn't create that task: ${escapeMarkdown(result.error)}\\.`);
      return;
    }
    const due = result.task.dueAt ? `\n📅 ${escapeMarkdown(formatDueDate(result.task.dueAt, result.task.dueHasTime))}` : "";
    await sendMessage(chatId, `✅ ${bold("Task created")}\n\n${escapeMarkdown(result.task.title)}${due}`, {
      buttons: [[{ text: "Undo", callback_data: `delete_task:${result.task.id}` }]],
    });
  } catch {
    await sendMessage(chatId, "AI is temporarily unavailable — try again in a moment\\.");
  }
}

const STOP_WORDS = new Set(["the", "a", "an", "as", "mark", "task", "done", "complete", "completed", "finished", "is", "to", "my"]);

// ponytail: naive keyword-overlap match, not fuzzy/AI matching — good enough
// for short task titles; swap for the intent model if it misses often.
async function findMatchingTasks(userId: string, phrase: string): Promise<TaskSummary[]> {
  const tasks = await prisma.task.findMany({
    where: { userId, completed: false },
    select: { id: true, title: true, dueAt: true, dueHasTime: true },
  });
  const words = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return tasks
    .map((t) => ({ t, score: words.filter((w) => t.title.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.t);
}

export async function handleCompleteTaskQuery(userId: string, chatId: string, phrase: string) {
  const matches = phrase.trim() ? await findMatchingTasks(userId, phrase) : [];
  if (matches.length === 0) {
    await sendMessage(chatId, "Which task? Here are your open tasks:");
    await handleListTasks(userId, chatId);
    return;
  }
  if (matches.length === 1) {
    await completeTask(userId, matches[0].id, chatId);
    return;
  }
  await sendMessage(chatId, "Found a few matches — which one?", {
    buttons: matches.map((t) => [{ text: t.title.slice(0, 60), callback_data: `complete:${t.id}` }]),
  });
}

async function completeTask(userId: string, taskId: string, chatId: string) {
  if (!(await ownsTask(taskId, userId))) return;
  const task = await prisma.task.update({ where: { id: taskId }, data: { completed: true, completedAt: new Date() } });
  await sendMessage(chatId, `✅ ${bold("Task completed")}\n\n${escapeMarkdown(task.title)}`);
}

// ---- Email ----

export async function handleEmailSummary(userId: string, chatId: string) {
  const { unreadCount, importantEmails } = await getEmailSummary(userId);
  const lines = [`📬 ${bold("Email Summary")}`, "", `You have ${unreadCount} unread email${unreadCount === 1 ? "" : "s"}\\.`];
  if (importantEmails.length > 0) {
    lines.push("", `🔴 ${bold("Important")}`);
    importantEmails.forEach((e) => lines.push(`• ${escapeMarkdown(e.subject || "(no subject)")} — ${escapeMarkdown(e.from)}`));
  }
  const buttons = importantEmails.map((e) => [
    urlButton("Open", emailDeepLink(e.id)),
    { text: "Summarize", callback_data: `summarize:${e.id}` },
    { text: "+Task", callback_data: `email_task:${e.id}` },
  ]);
  await sendMessage(chatId, lines.join("\n"), { buttons: buttons.length ? buttons : [[urlButton("Open Inbox", tasksDeepLink())]] });
}

export async function handleSummarizeEmail(userId: string, chatId: string, emailId: string) {
  const email = await prisma.email.findFirst({ where: { id: emailId, mailbox: { userId } } });
  if (!email) return;
  try {
    const { summary, bullets, action } = await summarizeEmail(email);
    const lines = [`🤖 ${bold("Summary")}`, "", escapeMarkdown(summary), "", ...bullets.map((b) => `• ${escapeMarkdown(b)}`)];
    if (action) lines.push("", `📋 Possible task: ${escapeMarkdown(action)}`);
    await sendMessage(chatId, lines.join("\n"), { buttons: [[urlButton("Open Email", emailDeepLink(emailId))]] });
  } catch {
    await sendMessage(chatId, "AI is temporarily unavailable — try again in a moment\\.");
  }
}

export async function handleEmailToTask(userId: string, chatId: string, emailId: string) {
  const email = await prisma.email.findFirst({ where: { id: emailId, mailbox: { userId } } });
  if (!email) return;
  try {
    const { action } = await summarizeEmail(email);
    if (!action) {
      await sendMessage(chatId, "No clear action found in that email\\.");
      return;
    }
    const result = await createTaskForUser(userId, { title: action, sourceEmailId: emailId });
    if (!result.ok) return;
    await sendMessage(chatId, `✅ ${bold("Task created")}\n\n${escapeMarkdown(result.task.title)}`);
  } catch {
    await sendMessage(chatId, "AI is temporarily unavailable — try again in a moment\\.");
  }
}

export async function handleAskInbox(userId: string, chatId: string, question: string) {
  const mailbox = await getDefaultMailbox(userId);
  if (!mailbox) {
    await sendMessage(chatId, "You don't have a mailbox set up yet\\.");
    return;
  }
  try {
    const { answer, cited } = await askInbox(mailbox.id, question);
    const buttons = cited.slice(0, 3).map((e) => [urlButton(`Open: ${e.subject}`.slice(0, 60), emailDeepLink(e.id))]);
    await sendMessage(chatId, escapeMarkdown(answer), { buttons: buttons.length ? buttons : undefined });
  } catch {
    await sendMessage(chatId, "AI is temporarily unavailable — try again in a moment\\.");
  }
}

export async function handleUnknown(chatId: string) {
  await sendMessage(chatId, "Not sure how to help with that yet — try /help for what I can do\\.");
}

// ---- Callback queries (inline button taps) ----

export async function handleCallback(
  userId: string,
  chatId: string,
  callbackQueryId: string,
  messageId: number,
  data: string
) {
  const [action, arg] = data.split(":");
  switch (action) {
    case "complete": {
      if (arg && (await ownsTask(arg, userId))) {
        const task = await prisma.task.update({ where: { id: arg }, data: { completed: true, completedAt: new Date() } });
        await answerCallbackQuery(callbackQueryId, "Completed");
        await editMessageText(chatId, messageId, `✅ ${bold("Task completed")}\n\n${escapeMarkdown(task.title)}`);
      } else {
        await answerCallbackQuery(callbackQueryId, "Not found");
      }
      return;
    }
    case "delete_task": {
      if (arg && (await ownsTask(arg, userId))) {
        await prisma.task.delete({ where: { id: arg } });
        await answerCallbackQuery(callbackQueryId, "Deleted");
        await editMessageText(chatId, messageId, "🗑 Task deleted\\.");
      } else {
        await answerCallbackQuery(callbackQueryId, "Not found");
      }
      return;
    }
    case "summarize": {
      await answerCallbackQuery(callbackQueryId);
      if (arg) await handleSummarizeEmail(userId, chatId, arg);
      return;
    }
    case "email_task": {
      await answerCallbackQuery(callbackQueryId);
      if (arg) await handleEmailToTask(userId, chatId, arg);
      return;
    }
    case "disconnect_confirm": {
      await disconnect(userId);
      await answerCallbackQuery(callbackQueryId, "Disconnected");
      await editMessageText(chatId, messageId, "Telegram disconnected from TrueMail\\.");
      return;
    }
    case "disconnect_cancel": {
      await answerCallbackQuery(callbackQueryId, "Cancelled");
      await editMessageText(chatId, messageId, "Cancelled\\.");
      return;
    }
    default:
      await answerCallbackQuery(callbackQueryId);
  }
}
