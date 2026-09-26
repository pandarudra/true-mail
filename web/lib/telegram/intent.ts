import { chatJSON } from "@/lib/ai/nvidia";

export const INTENTS = [
  "daily_summary",
  "list_tasks",
  "create_task",
  "complete_task",
  "email_summary",
  "calendar_today",
  "goal_today",
  "ask_inbox",
  "unknown",
] as const;

export type Intent = (typeof INTENTS)[number];

export type IntentResult = {
  intent: Intent;
  // Only meaningful for create_task/complete_task (the raw phrase to match a
  // task by) and ask_inbox (the question to answer) — the handler re-derives
  // structured fields (title/dueAt, etc.) from `text` itself rather than
  // trusting the classifier for anything beyond routing.
  text: string;
};

// One chatJSON call maps free text to a fixed intent enum — there's no native
// tool-calling API on lib/ai/nvidia's model, so this is the whole "AI tool
// layer": classify, then a plain switch in router.ts dispatches to a real
// handler. The model never touches the database directly.
export async function classifyIntent(text: string): Promise<IntentResult> {
  try {
    const result = await chatJSON<{ intent: string }>({
      system:
        "Classify a message to a personal productivity assistant into exactly one intent. " +
        "Respond with strict JSON only, no markdown, no code fences: " +
        `{"intent": string}, where intent is one of: ${INTENTS.join(", ")}. ` +
        "daily_summary: asking for today's overview/plan/briefing. " +
        "list_tasks: asking to see tasks/todos, including overdue or upcoming ones. " +
        "create_task: asking to create/add/remind about a task. " +
        "complete_task: saying a task is done/finished/completed. " +
        "email_summary: asking about emails/inbox in general, or what needs attention. " +
        "calendar_today: asking about meetings/events/calendar for a specific day. " +
        "goal_today: asking what to focus on or what the most important thing is. " +
        "ask_inbox: a specific question about email content (e.g. finding an email from someone). " +
        "unknown: anything else, including greetings and small talk.",
      user: text,
      maxTokens: 20,
      temperature: 0,
    });
    const intent = INTENTS.find((i) => i === result.intent) ?? "unknown";
    return { intent, text };
  } catch {
    return { intent: "unknown", text };
  }
}
