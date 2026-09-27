import { chatJSON } from "@/lib/ai/nvidia";
import { hasExplicitTime, localNaiveToUtcIso } from "@/lib/ai/local-datetime";

type ParseTaskResult = {
  title: string;
  dueAt: string | null;
  recurrenceType: string | null;
  recurrenceDaysOfWeek: number[] | null;
  reminderTime: string | null;
};

export type RecurrenceType = "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY";
const RECURRENCE_TYPES = new Set<string>(["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY"]);

export type ParsedRecurrence = {
  recurrenceType: RecurrenceType;
  recurrenceDaysOfWeek: number[];
  // null means "recurring, but no time was stated" — the caller should ask
  // rather than guess (spec: don't over-automate an ambiguous request).
  reminderTime: string | null;
};

export type ParsedTask = {
  title: string;
  dueAt: string | null;
  dueHasTime: boolean;
  recurrence: ParsedRecurrence | null;
};

// Shared by app/api/ai/parse-task (web quick-add) and the Telegram
// create-task flow — same prompt, same local-time framing, one place to fix.
export async function parseTaskFromText(text: string, timezoneOffsetMinutes: number): Promise<ParsedTask> {
  const localNow = new Date(Date.now() - timezoneOffsetMinutes * 60000);
  const result = await chatJSON<ParseTaskResult>({
    system:
      "You turn one sentence describing a task into structured data. Respond with strict JSON " +
      'only, no markdown, no code fences: {"title": string, "dueAt": string | null, ' +
      '"recurrenceType": string | null, "recurrenceDaysOfWeek": number[] | null, "reminderTime": string | null}. ' +
      '"title" is a short imperative task title with reminder/recurrence phrasing removed (e.g. "Remind me ' +
      'every day to study DSA at 9pm" becomes "Study DSA"). "dueAt" is a LOCAL (not UTC) datetime string shaped ' +
      'like "YYYY-MM-DDTHH:mm:ss" (no timezone suffix) if the sentence implies a specific one-off date ' +
      `(resolve relative terms like "tomorrow" or "Friday" against today's date, which is ` +
      `${localNow.toISOString().slice(0, 10)}, a ${localNow.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}); ` +
      'null if no date is implied, or if the sentence describes a *recurring* task instead (recurrence uses the ' +
      "fields below, not dueAt). " +
      'If the sentence describes something repeating ("every day", "daily", "every weekday", "every Monday", ' +
      '"every Monday and Friday", "weekly", "monthly", "every morning"), set "recurrenceType" to one of ' +
      '"DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY" and "recurrenceDaysOfWeek" to the stated days as ' +
      "0=Sunday..6=Saturday (empty array if WEEKLY with no specific day named, or not applicable to the type). " +
      'Otherwise both are null. "reminderTime" is the stated clock time as "HH:mm" (24-hour) if the sentence ' +
      'gives one, whether for a recurring or one-off task — e.g. "at 9pm" is "21:00", "every morning at 7" is ' +
      '"07:00" — otherwise null (never guess a time that was not actually stated).',
    user: text,
    maxTokens: 200,
    temperature: 0.2,
  });

  if (typeof result.title !== "string" || !result.title.trim()) {
    throw new Error("no title");
  }

  const recurrenceType = RECURRENCE_TYPES.has(result.recurrenceType ?? "") ? (result.recurrenceType as RecurrenceType) : null;
  const recurrence: ParsedRecurrence | null = recurrenceType
    ? {
        recurrenceType,
        recurrenceDaysOfWeek: Array.isArray(result.recurrenceDaysOfWeek) ? result.recurrenceDaysOfWeek : [],
        reminderTime: typeof result.reminderTime === "string" ? result.reminderTime : null,
      }
    : null;

  // A recurring task's date comes from the recurrence engine, not dueAt —
  // ignore whatever the model put there so callers never see conflicting
  // one-off/recurring signals for the same task.
  const naiveLocalDueAt = !recurrence && typeof result.dueAt === "string" ? result.dueAt : null;

  return {
    title: result.title.trim(),
    dueAt: naiveLocalDueAt !== null ? localNaiveToUtcIso(naiveLocalDueAt, timezoneOffsetMinutes) : null,
    dueHasTime: naiveLocalDueAt !== null && hasExplicitTime(naiveLocalDueAt),
    recurrence,
  };
}
