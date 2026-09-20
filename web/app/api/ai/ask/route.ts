import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { emailBodyText } from "@/lib/email-text";
import { chatJSON } from "@/lib/ai/nvidia";

const CONTEXT_LIMIT = 60;

type AskResult = { answer: string; citedEmailIds: string[] };

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const mailboxId: string | undefined = body?.mailboxId;
  const question: string | undefined = body?.question;
  if (!mailboxId || !question?.trim()) {
    return NextResponse.json({ error: "mailboxId and question are required" }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId, userId } });
  if (!mailbox) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const emails = await prisma.email.findMany({
    where: { mailboxId, trashedAt: null, spam: false },
    orderBy: { createdAt: "desc" },
    take: CONTEXT_LIMIT,
  });

  const context = emails.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    subject: e.subject,
    createdAt: e.createdAt.toISOString(),
    snippet: emailBodyText(e).slice(0, 200),
  }));
  const contextIds = new Set(context.map((e) => e.id));

  try {
    const result = await chatJSON<AskResult>({
      system:
        "You answer questions about a mailbox using only the emails provided as JSON context. " +
        "Respond with strict JSON only, no markdown, no code fences: " +
        '{"answer": string, "citedEmailIds": string[]}. ' +
        '"answer" directly answers the question in 1-3 sentences, referencing specifics (names, dates, amounts) ' +
        'from the context where relevant. "citedEmailIds" lists the ids of emails you used to answer, from the ' +
        "context's own id fields only. If nothing in the context answers the question, say so in \"answer\" " +
        'and return an empty "citedEmailIds" array.',
      user: `Question: ${question.trim()}\n\nEmails (most recent first):\n${JSON.stringify(context)}`,
      maxTokens: 500,
      temperature: 0.2,
    });

    // Never trust model-cited ids blindly — filter to ones actually in context.
    const citedEmailIds = result.citedEmailIds.filter((id) => contextIds.has(id));
    const cited = context
      .filter((e) => citedEmailIds.includes(e.id))
      .map(({ id, from, subject }) => ({ id, from, subject }));

    return NextResponse.json({ answer: result.answer, cited });
  } catch {
    return NextResponse.json({ error: "AI is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
