import { prisma } from "@/lib/db";
import { emailBodyText } from "@/lib/email-text";
import { chatJSON } from "@/lib/ai/nvidia";

const CONTEXT_LIMIT = 60;

type AskResult = { answer: string; citedEmailIds: string[] };
export type AskInboxResult = { answer: string; cited: { id: string; from: string; subject: string }[] };

// Shared by app/api/ai/ask (the web "Ask your inbox" bar) and Telegram's
// natural-language email questions — same context window, same prompt.
export async function askInbox(mailboxId: string, question: string): Promise<AskInboxResult> {
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

  return { answer: result.answer, cited };
}
