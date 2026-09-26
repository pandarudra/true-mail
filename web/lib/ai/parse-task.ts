import { chatJSON } from "@/lib/ai/nvidia";
import { hasExplicitTime, localNaiveToUtcIso } from "@/lib/ai/local-datetime";

type ParseTaskResult = { title: string; dueAt: string | null };

export type ParsedTask = { title: string; dueAt: string | null; dueHasTime: boolean };

// Shared by app/api/ai/parse-task (web quick-add) and the Telegram
// create-task flow — same prompt, same local-time framing, one place to fix.
export async function parseTaskFromText(text: string, timezoneOffsetMinutes: number): Promise<ParsedTask> {
  const localNow = new Date(Date.now() - timezoneOffsetMinutes * 60000);
  const result = await chatJSON<ParseTaskResult>({
    system:
      "You turn one sentence describing a task into structured data. Respond with strict JSON " +
      'only, no markdown, no code fences: {"title": string, "dueAt": string | null}. ' +
      '"title" is a short imperative task title with reminder phrasing removed (e.g. "Remind me to ' +
      'send the proposal" becomes "Send the proposal"). "dueAt" is a LOCAL (not UTC) datetime ' +
      'string shaped like "YYYY-MM-DDTHH:mm:ss" (no timezone suffix) if the sentence implies a date ' +
      `(resolve relative terms like "tomorrow" or "Friday" against today's date, which is ` +
      `${localNow.toISOString().slice(0, 10)}, a ${localNow.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}). ` +
      'If a clock time was stated, use it as-is (do not convert timezones, just write the stated ' +
      'wall-clock time); otherwise use 00:00:00 for that date. "dueAt" is null if no date is implied at all.',
    user: text,
    maxTokens: 150,
    temperature: 0.2,
  });
  if (typeof result.title !== "string" || !result.title.trim()) {
    throw new Error("no title");
  }
  const naiveLocalDueAt = typeof result.dueAt === "string" ? result.dueAt : null;
  return {
    title: result.title.trim(),
    dueAt: naiveLocalDueAt !== null ? localNaiveToUtcIso(naiveLocalDueAt, timezoneOffsetMinutes) : null,
    dueHasTime: naiveLocalDueAt !== null && hasExplicitTime(naiveLocalDueAt),
  };
}
