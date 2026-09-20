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
function hasExplicitTime(dueAt: string): boolean {
  return !/T00:00:00(\.000)?Z?$/.test(dueAt);
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

  const now = new Date();
  try {
    const result = await chatJSON<ParseTaskResult>({
      system:
        "You turn one sentence describing a task into structured data. Respond with strict JSON " +
        'only, no markdown, no code fences: {"title": string, "dueAt": string | null}. ' +
        '"title" is a short imperative task title with reminder phrasing removed (e.g. "Remind me to ' +
        'send the proposal" becomes "Send the proposal"). "dueAt" is an ISO 8601 timestamp if the ' +
        "sentence implies a date (resolve relative terms like \"tomorrow\" or \"Friday\" against " +
        `today's date, ${now.toISOString()}, ${now.toLocaleDateString(undefined, { weekday: "long" })}). ` +
        'If a clock time was stated, include it in "dueAt"; otherwise use 00:00:00 for that date. ' +
        '"dueAt" is null if no date is implied at all.',
      user: text,
      maxTokens: 150,
      temperature: 0.2,
    });
    if (typeof result.title !== "string" || !result.title.trim()) {
      throw new Error("no title");
    }
    const dueAt = typeof result.dueAt === "string" ? result.dueAt : null;
    return NextResponse.json({
      title: result.title.trim(),
      dueAt,
      dueHasTime: dueAt !== null && hasExplicitTime(dueAt),
    });
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
