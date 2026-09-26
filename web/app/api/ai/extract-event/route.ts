import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { emailBodyText } from "@/lib/email-text";
import { chatJSON } from "@/lib/ai/nvidia";
import { hasExplicitTime, localNaiveToUtcIso } from "@/lib/ai/local-datetime";

type ExtractEventResult = { title: string | null; dueAt: string | null };

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
  const timezoneOffsetMinutes =
    typeof body?.timezoneOffsetMinutes === "number" ? body.timezoneOffsetMinutes : 0;

  const email = await prisma.email.findFirst({ where: { id: emailId, mailbox: { userId } } });
  if (!email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Already added to the calendar (as a Task) from this email — don't
  // re-detect and resurface the same suggestion.
  const alreadyAdded = await prisma.task.findFirst({ where: { sourceEmailId: emailId, userId } });
  if (alreadyAdded) {
    return NextResponse.json({ event: null });
  }

  // Same local-time framing as parse-task: the model reasons in the user's
  // own wall-clock time, not server/UTC time.
  const localNow = new Date(Date.now() - timezoneOffsetMinutes * 60000);
  try {
    const result = await chatJSON<ExtractEventResult>({
      system:
        "You detect whether an email describes ONE scheduled event (an interview, meeting, " +
        "appointment, or call) tied to a specific date — not a deadline, due date, or general " +
        'mention of a date. Respond with strict JSON only, no markdown, no code fences: ' +
        '{"title": string | null, "dueAt": string | null}. If the email clearly describes such an ' +
        'event, "title" is a short 2-4 word label for it (e.g. "Interview", "Team meeting", ' +
        '"Dentist appointment") and "dueAt" is a LOCAL (not UTC) datetime string shaped like ' +
        '"YYYY-MM-DDTHH:mm:ss" (no timezone suffix), using the event\'s stated date and, if given, ' +
        'its clock time (otherwise 00:00:00) — resolve relative dates against today, which is ' +
        `${localNow.toISOString().slice(0, 10)}, a ${localNow.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}. ` +
        'If the email does not clearly describe one scheduled event with a date, return ' +
        '{"title": null, "dueAt": null}.',
      user: `Subject: ${email.subject}\n\n${emailBodyText(email)}`,
      maxTokens: 150,
      temperature: 0.2,
    });

    const title = typeof result.title === "string" ? result.title.trim() : "";
    const naiveLocalDueAt = typeof result.dueAt === "string" ? result.dueAt : null;
    if (!title || !naiveLocalDueAt) {
      return NextResponse.json({ event: null });
    }

    return NextResponse.json({
      event: {
        title,
        dueAt: localNaiveToUtcIso(naiveLocalDueAt, timezoneOffsetMinutes),
        dueHasTime: hasExplicitTime(naiveLocalDueAt),
      },
    });
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
