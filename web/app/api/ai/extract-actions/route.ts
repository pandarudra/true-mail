import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { emailBodyText } from "@/lib/email-text";
import { chatJSON } from "@/lib/ai/nvidia";

type ExtractActionsResult = { actions: string[] };

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
    const result = await chatJSON<ExtractActionsResult>({
      system:
        "You extract concrete action items from a single email. Respond with strict JSON only, " +
        'no markdown, no code fences: {"actions": string[]}. Each entry is a short imperative ' +
        'phrase (e.g. "Review proposal", "Send feedback"), 2-6 words, starting with a verb. ' +
        "Return at most 5 actions. Return an empty array if the email asks for nothing actionable.",
      user: `Subject: ${email.subject}\n\n${emailBodyText(email)}`,
      maxTokens: 150,
      temperature: 0.2,
    });
    const actions = Array.isArray(result.actions) ? result.actions.filter((a) => typeof a === "string") : [];
    return NextResponse.json({ actions });
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
