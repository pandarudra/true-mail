// Telegram's MarkdownV2 treats these as syntax and 400s the whole message if
// they appear unescaped in dynamic text (an email subject, a task title...).
// https://core.telegram.org/bots/api#markdownv2-style
const MARKDOWN_V2_SPECIAL = /[_*[\]()~`>#+\-=|{}.!\\]/g;

export function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIAL, (ch) => `\\${ch}`);
}

export function bold(text: string): string {
  return `*${escapeMarkdown(text)}*`;
}

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function emailDeepLink(emailId: string): string {
  return `${appUrl()}/inbox?emailId=${emailId}`;
}

export function tasksDeepLink(): string {
  return `${appUrl()}/tasks`;
}

export function calendarDeepLink(): string {
  return `${appUrl()}/cal`;
}

export function settingsDeepLink(): string {
  return `${appUrl()}/settings`;
}

export function formatDueDate(dueAt: Date, dueHasTime: boolean): string {
  return dueAt.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    ...(dueHasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}
