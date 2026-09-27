import { chatJSON } from "@/lib/ai/nvidia";
import { hasExplicitTime, localNaiveToUtcIso } from "@/lib/ai/local-datetime";
import { emailBodyText } from "@/lib/email-text";

type ExtractPromiseResult = {
  isPromise: boolean;
  commitment: string | null;
  deadline: string | null;
  confidence: number;
};

export type ExtractedPromise = {
  commitment: string;
  dueAt: string | null;
  dueHasTime: boolean;
  confidence: number;
};

export function parseAddress(raw: string): { name: string | null; email: string | null } {
  const match = raw.match(/^(.*?)<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { name: name || null, email: match[2].trim() };
  }
  const trimmed = raw.trim();
  return trimmed.includes("@") ? { name: null, email: trimmed } : { name: trimmed || null, email: null };
}

// Direction and the person involved are derived from the email's own
// direction/from/to fields — not asked of the AI — since they're
// deterministic (an inbound email's first-person commitment is the
// sender's; an outbound one is the mailbox owner's, made to the recipient)
// and more reliable than an AI guess.
export function personFromEmail(email: { direction: string; from: string; to: string[] }): {
  name: string | null;
  email: string | null;
} {
  return email.direction === "in" ? parseAddress(email.from) : parseAddress(email.to[0] ?? "");
}

// Shared by app/api/ai/extract-promise and (later) any other surface that
// wants promise detection over an email — same prompt either way.
export async function extractPromise(
  email: { subject: string; text: string | null; html: string | null; direction: string },
  timezoneOffsetMinutes: number
): Promise<ExtractedPromise | null> {
  const localNow = new Date(Date.now() - timezoneOffsetMinutes * 60000);
  const perspective =
    email.direction === "in" ? "the email's sender" : "the email's author (the mailbox owner, writing to their recipient)";

  const result = await chatJSON<ExtractPromiseResult>({
    system:
      `You detect whether an email contains ONE explicit, first-person commitment made by ${perspective} — ` +
      "something they will personally do, stated with clear intention to follow through, not a deadline " +
      "someone else set or a general mention of a date. Respond with strict JSON only, no markdown, no code " +
      'fences: {"isPromise": boolean, "commitment": string | null, "deadline": string | null, "confidence": number}. ' +
      'Track EXPLICIT commitments: "I\'ll send...", "I will complete...", "We\'ll deliver...", "I\'ll get back ' +
      'to you tomorrow", "You can expect...". Do NOT track hedged or uncertain language as a promise — for ' +
      '"I hope to...", "We might...", "Maybe I\'ll...", "We are considering...", "It would be nice to...", ' +
      'set "isPromise" to false. If "isPromise" is true: "commitment" is a short imperative phrase (e.g. "Send ' +
      'the revised proposal"), "deadline" is a LOCAL (not UTC) datetime string shaped like "YYYY-MM-DDTHH:mm:ss" ' +
      "if a date or relative timeframe is stated (resolve relative dates against today, which is " +
      `${localNow.toISOString().slice(0, 10)}, a ${localNow.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}), ` +
      'or null if no deadline is implied, and "confidence" is 0 to 1 — how certain you are this is a genuine, ' +
      'explicit, first-person commitment (not something weaker). If "isPromise" is false, "commitment" and ' +
      '"deadline" are null and "confidence" is 0.',
    user: `Subject: ${email.subject}\n\n${emailBodyText(email)}`,
    maxTokens: 150,
    temperature: 0.1,
  });

  if (!result.isPromise || typeof result.commitment !== "string" || !result.commitment.trim()) {
    return null;
  }

  const naiveLocalDueAt = typeof result.deadline === "string" ? result.deadline : null;
  const confidence = typeof result.confidence === "number" ? Math.max(0, Math.min(1, result.confidence)) : 0.5;

  return {
    commitment: result.commitment.trim(),
    dueAt: naiveLocalDueAt ? localNaiveToUtcIso(naiveLocalDueAt, timezoneOffsetMinutes) : null,
    dueHasTime: naiveLocalDueAt ? hasExplicitTime(naiveLocalDueAt) : false,
    confidence,
  };
}
