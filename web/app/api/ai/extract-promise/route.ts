import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { hasPromiseForEmail } from "@/lib/promises";
import { extractPromise, personFromEmail } from "@/lib/ai/extract-promise";

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const emailId: string | undefined = body?.emailId;
  if (!emailId) {
    return NextResponse.json({ error: "emailId is required" }, { status: 400 });
  }
  const timezoneOffsetMinutes = typeof body?.timezoneOffsetMinutes === "number" ? body.timezoneOffsetMinutes : 0;

  const email = await prisma.email.findFirst({ where: { id: emailId, mailbox: { userId } } });
  if (!email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Already tracked (or explicitly created) from this email — don't
  // re-detect and resurface the same suggestion.
  if (await hasPromiseForEmail(userId, emailId)) {
    return NextResponse.json({ promise: null });
  }

  try {
    const extracted = await extractPromise(email, timezoneOffsetMinutes);
    if (!extracted) {
      return NextResponse.json({ promise: null });
    }

    const person = personFromEmail(email);
    return NextResponse.json({
      promise: {
        direction: email.direction === "in" ? "INCOMING" : "OUTGOING",
        personName: person.name,
        personEmail: person.email,
        commitment: extracted.commitment,
        dueAt: extracted.dueAt,
        dueHasTime: extracted.dueHasTime,
        confidence: extracted.confidence,
      },
    });
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
