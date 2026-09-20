import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { emailBodyText } from "@/lib/email-text";
import { chatJSON } from "@/lib/ai/nvidia";

type SummaryResult = { summary: string; bullets: string[]; action: string | null };

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

  const email = await prisma.email.findFirst({ where: { id: emailId, mailbox: { userId } } });
  if (!email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const result = await chatJSON<SummaryResult>({
      system:
        "You summarize a single email. Respond with strict JSON only, no markdown, no code fences: " +
        '{"summary": string, "bullets": string[], "action": string | null}. ' +
        '"summary" is one short sentence. "bullets" are 2-5 short factual points from the email. ' +
        '"action" is a single next step the recipient should take, or null if none.',
      user: `From: ${email.from}\nDate: ${email.createdAt.toISOString()}\nSubject: ${email.subject}\n\n${emailBodyText(email)}`,
      maxTokens: 300,
      temperature: 0.2,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
