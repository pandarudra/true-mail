import { chatJSON } from "@/lib/ai/nvidia";
import { emailBodyText } from "@/lib/email-text";

export type EmailSummary = { summary: string; bullets: string[]; action: string | null };

type EmailLike = { from: string; subject: string; createdAt: Date | string; text: string | null; html: string | null };

// Shared by app/api/ai/summarize (ReadingPane's summary card) and Telegram's
// "Summarize this email" — same prompt either way.
export async function summarizeEmail(email: EmailLike): Promise<EmailSummary> {
  const createdAt = typeof email.createdAt === "string" ? email.createdAt : email.createdAt.toISOString();
  return chatJSON<EmailSummary>({
    system:
      "You summarize a single email. Respond with strict JSON only, no markdown, no code fences: " +
      '{"summary": string, "bullets": string[], "action": string | null}. ' +
      '"summary" is one short sentence. "bullets" are 2-5 short factual points from the email. ' +
      '"action" is a single next step the recipient should take, or null if none.',
    user: `From: ${email.from}\nDate: ${createdAt}\nSubject: ${email.subject}\n\n${emailBodyText(email)}`,
    maxTokens: 300,
    temperature: 0.2,
  });
}
