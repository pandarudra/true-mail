import { chatJSON } from "@/lib/ai/nvidia";
import { emailBodyText } from "@/lib/email-text";

type MatchFulfillmentResult = { matches: boolean; confidence: number };
export type FulfillmentMatch = { matches: boolean; confidence: number };

// Shared by app/api/ai/match-fulfillment — judges whether a newly-opened
// email plausibly delivers on a previously tracked incoming promise.
export async function matchFulfillment(
  commitment: string,
  email: { subject: string; text: string | null; html: string | null }
): Promise<FulfillmentMatch> {
  const result = await chatJSON<MatchFulfillmentResult>({
    system:
      "You judge whether an email plausibly fulfills a previously tracked commitment. Respond with strict " +
      'JSON only, no markdown, no code fences: {"matches": boolean, "confidence": number}. "matches" is true ' +
      "only if the email's content plausibly delivers on, or reports having completed, the commitment below " +
      "(e.g. attaching/describing the promised thing, or explicitly saying it's done) — not just mentioning " +
      'the same general topic. "confidence" is 0 to 1.',
    user: `Commitment: ${commitment}\n\nNew email —\nSubject: ${email.subject}\n\n${emailBodyText(email)}`,
    maxTokens: 60,
    temperature: 0.1,
  });
  return {
    matches: !!result.matches,
    confidence: typeof result.confidence === "number" ? Math.max(0, Math.min(1, result.confidence)) : 0.5,
  };
}
