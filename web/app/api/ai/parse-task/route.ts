import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { parseTaskFromText } from "@/lib/ai/parse-task";

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

  try {
    const parsed = await parseTaskFromText(text, timezoneOffsetMinutes);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
