import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { runAssistant, type ChatTurn } from "@/lib/ai/orchestrator";
import { buildMcpHandlers } from "@/lib/ai/mcp-handlers";

function isValidTurns(value: unknown): value is ChatTurn[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (t) =>
        t &&
        typeof t === "object" &&
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim().length > 0
    )
  );
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!isValidTurns(body?.messages)) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }
  const timezoneOffsetMinutes =
    typeof body?.timezoneOffsetMinutes === "number" ? body.timezoneOffsetMinutes : 0;

  try {
    const result = await runAssistant(
      userId,
      body.messages,
      timezoneOffsetMinutes,
      buildMcpHandlers()
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Agent is temporarily unavailable. Please try again." },
      { status: 502 }
    );
  }
}
