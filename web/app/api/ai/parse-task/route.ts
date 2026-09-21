import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { chatJSON } from "@/lib/ai/nvidia";

type ParseTaskResult = { title: string; dueAt: string | null };

// The model was asked to also return a "dueHasTime" boolean directly, but it
// unreliably said true even when it had defaulted an implied date to
// midnight (no time was actually stated) — deriving it from the timestamp's
// own shape instead is simpler and doesn't depend on the model getting a
// second field right. Trade-off: a task genuinely due at literal midnight
// reads as date-only, which is the rarer case.
function hasExplicitTime(naiveLocalDueAt: string): boolean {
  return !/T00:00:00(\.000)?$/.test(naiveLocalDueAt);
}

// The model reliably reasons about wall-clock local time ("tomorrow at
// 6pm") but not about converting that into a UTC offset — asking it to do
// both in one step silently drops the conversion. So it only ever returns a
// naive local datetime (no Z), and the UTC conversion is exact arithmetic
// here instead of something an LLM has to get right.
function localNaiveToUtcIso(naiveLocalDueAt: string, timezoneOffsetMinutes: number): string {
  const utcMs = Date.parse(`${naiveLocalDueAt}Z`) + timezoneOffsetMinutes * 60000;
  return new Date(utcMs).toISOString();
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const text: string | undefined = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  // Browser's Date#getTimezoneOffset: minutes to ADD to local time to get UTC
  // (e.g. IST is -330). Defaults to UTC if the client didn't send one.
  const timezoneOffsetMinutes =
    typeof body?.timezoneOffsetMinutes === "number" ? body.timezoneOffsetMinutes : 0;

  // The model reasons in the user's own local time, so "now" is given to it
  // in that local time too (not server/UTC time) — otherwise "today"/"tomorrow"
  // can resolve to the wrong calendar date near midnight in either direction.
  const localNow = new Date(Date.now() - timezoneOffsetMinutes * 60000);
  try {
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
    return NextResponse.json({
      title: result.title.trim(),
      dueAt: naiveLocalDueAt !== null ? localNaiveToUtcIso(naiveLocalDueAt, timezoneOffsetMinutes) : null,
      dueHasTime: naiveLocalDueAt !== null && hasExplicitTime(naiveLocalDueAt),
    });
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
