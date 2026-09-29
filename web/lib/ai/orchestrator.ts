import { chatWithTools, type ChatFn, type ChatMessage, type ToolDef } from "./nvidia";
import { searchEmailsForUser, loadOwnedEmail } from "@/lib/emails";
import { emailBodyText } from "@/lib/email-text";
import { getTasksForUser, createTaskForUser, completeTaskForUser } from "@/lib/tasks";
import { searchPromisesForUser, createPromiseForUser } from "@/lib/promises";
import type { ChatResult, ChatTurn, Citation, ProposedAction } from "./orchestrator-shared";

export type { ChatResult, ChatTurn, Citation, ProposedAction } from "./orchestrator-shared";

export type ToolHandlerMap = Record<string, (userId: string, args: Record<string, unknown>) => Promise<unknown>>;

const DEFAULT_MAX_ITERATIONS = 6;

function isEmailLike(value: unknown): value is { id: string; from: string; subject: string; snippet?: string; body?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === "string" &&
    typeof (value as Record<string, unknown>).from === "string" &&
    typeof (value as Record<string, unknown>).subject === "string"
  );
}

function collectCitations(toolName: string, output: unknown, citations: Map<string, Citation>): void {
  if (toolName === "search_emails" && Array.isArray(output)) {
    for (const item of output) {
      if (isEmailLike(item)) {
        citations.set(item.id, { emailId: item.id, from: item.from, subject: item.subject, snippet: (item.snippet ?? "").slice(0, 200) });
      }
    }
  } else if (toolName === "get_email" && isEmailLike(output)) {
    citations.set(output.id, {
      emailId: output.id,
      from: output.from,
      subject: output.subject,
      snippet: (output.body ?? "").slice(0, 200),
    });
  }
}

function collectProposedAction(toolName: string, args: Record<string, unknown>, actions: ProposedAction[]): void {
  if (toolName === "propose_task") {
    const title = typeof args.title === "string" ? args.title : "Untitled";
    actions.push({ type: "create_task", label: `Create task: ${title}`, params: args });
  } else if (toolName === "propose_promise") {
    const commitment = typeof args.commitment === "string" ? args.commitment : "Untitled";
    actions.push({ type: "create_promise", label: `Track promise: ${commitment}`, params: args });
  }
}

// The pure tool-call loop — dependency-injected (chatFn, handlers) so it's
// testable without a network call or a database. runAssistant (below) is
// the thin real wiring that calls this with the actual NVIDIA client and
// tool registry.
export async function runToolLoop(
  userId: string,
  turns: ChatTurn[],
  opts: { chatFn: ChatFn; handlers: ToolHandlerMap; tools: ToolDef[]; systemPrompt: string; maxIterations?: number }
): Promise<ChatResult> {
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const messages: ChatMessage[] = [
    { role: "system", content: opts.systemPrompt },
    ...turns.map((t): ChatMessage => ({ role: t.role, content: t.content })),
  ];

  const citations = new Map<string, Citation>();
  const actions: ProposedAction[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const result = await opts.chatFn({ messages, tools: opts.tools, maxTokens: 700 });

    if ("content" in result) {
      return { message: result.content, citations: [...citations.values()], actions };
    }

    messages.push({
      role: "assistant",
      content: null,
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.rawArguments },
      })),
    });

    for (const call of result.toolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      let output: unknown;
      try {
        parsedArgs = call.rawArguments ? JSON.parse(call.rawArguments) : {};
        const handler = opts.handlers[call.name];
        if (!handler) throw new Error(`unknown tool: ${call.name}`);
        output = await handler(userId, parsedArgs);
      } catch (err) {
        output = { error: err instanceof Error ? err.message : "tool call failed" };
      }

      collectCitations(call.name, output, citations);
      collectProposedAction(call.name, parsedArgs, actions);

      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
    }
  }

  return {
    message: "I wasn't able to finish that within a reasonable number of steps — try rephrasing or asking a smaller question.",
    citations: [...citations.values()],
    actions,
  };
}

const SYSTEM_PROMPT = `You are Ask AI, TrueMail's assistant. You have tools to search and read the user's emails, and to search, create, and complete their tasks and promises, and to look up their calendar (scheduled tasks — TrueMail has no separate events model, a task with a due date is a calendar entry).

Rules:
- Always call a tool to look up current data before answering a question about the user's emails, tasks, promises, or schedule. Never guess or invent information.
- Answer naturally, in plain language. Never mention tool or function names, or say that you are calling a tool.
- Only call create_task or create_promise when the user has explicitly asked you to create, add, or track something. When you are just listing or summarizing things you found, call propose_task or propose_promise instead for each one you'd suggest (or make no such call if there's nothing worth suggesting) — never call both a create and a propose tool for the same thing in one turn.
- When you use information from a specific email to answer, make sure you reached it via search_emails or get_email so its source can be shown to the user.
- Keep answers concise — a few sentences, not an essay.`;

const TOOL_DEFS: ToolDef[] = [
  {
    name: "search_emails",
    description:
      "Search the user's emails by keyword, across all mailboxes. Returns id, from, subject, and a short snippet for each match.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword or phrase to search for in the subject, sender, or body." },
        folder: {
          type: "string",
          enum: ["inbox", "starred", "sent", "drafts", "important", "archive", "spam", "trash", "all"],
        },
        limit: { type: "number", description: "Max results, default 10, capped at 20." },
      },
    },
  },
  {
    name: "get_email",
    description: "Get the full body of one specific email by id, once you know which email you need (e.g. from a search_emails result).",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "search_tasks",
    description: "Search the user's tasks.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword to match against task titles." },
        status: { type: "string", enum: ["all", "pending", "completed", "overdue"] },
      },
    },
  },
  {
    name: "create_task",
    description: "Create a new task for the user. Only call this when the user has explicitly asked you to create, add, or make a task.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueAt: { type: "string", description: "ISO date, optional." },
        priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "URGENT"] },
        description: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "propose_task",
    description:
      "Suggest a task the user could create, without creating it yet. Use this when you're just listing or summarizing things you found and the user hasn't explicitly asked you to create anything — the user will see a button to confirm.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueAt: { type: "string" },
        priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "URGENT"] },
        description: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as done, by id.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "search_promises",
    description: "Search the user's tracked promises (commitments made to or by the user).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        status: { type: "string", enum: ["all", "active", "fulfilled", "dismissed"] },
      },
    },
  },
  {
    name: "create_promise",
    description: "Track a new promise. Only call this when the user has explicitly asked you to create, add, or track a promise/commitment.",
    parameters: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["INCOMING", "OUTGOING"],
          description: "INCOMING = someone promised the user something. OUTGOING = the user promised someone (or themselves) something.",
        },
        commitment: { type: "string" },
        personName: { type: "string" },
        personEmail: { type: "string" },
        dueAt: { type: "string" },
      },
      required: ["direction", "commitment"],
    },
  },
  {
    name: "propose_promise",
    description:
      "Suggest a promise the user could track, without creating it yet — same rule as propose_task: use this when merely describing findings, not when explicitly asked to track something.",
    parameters: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["INCOMING", "OUTGOING"] },
        commitment: { type: "string" },
        personName: { type: "string" },
        personEmail: { type: "string" },
        dueAt: { type: "string" },
      },
      required: ["direction", "commitment"],
    },
  },
  {
    name: "search_calendar",
    description:
      "List tasks with a due date in a date range — this is the user's calendar (TrueMail has no separate events model; scheduled tasks are the calendar).",
    parameters: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "ISO date, defaults to today." },
        toDate: { type: "string", description: "ISO date, defaults to 7 days after fromDate." },
      },
    },
  },
];

const TOOL_HANDLERS: ToolHandlerMap = {
  search_emails: async (userId, args) =>
    searchEmailsForUser(userId, {
      query: typeof args.query === "string" ? args.query : undefined,
      folder: typeof args.folder === "string" ? args.folder : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined,
    }),

  get_email: async (userId, args) => {
    const email = await loadOwnedEmail(String(args.id ?? ""), userId);
    if (!email) return { error: "email not found" };
    return { id: email.id, from: email.from, subject: email.subject, date: email.createdAt, body: emailBodyText(email) };
  },

  search_tasks: async (userId, args) => {
    const all = await getTasksForUser(userId);
    const now = new Date();
    const status = typeof args.status === "string" ? args.status : "all";
    let filtered = all;
    if (status === "pending") filtered = filtered.filter((t) => !t.completed);
    else if (status === "completed") filtered = filtered.filter((t) => t.completed);
    else if (status === "overdue") filtered = filtered.filter((t) => !t.completed && !!t.dueAt && t.dueAt < now);
    if (typeof args.query === "string" && args.query) {
      const q = args.query.toLowerCase();
      filtered = filtered.filter((t) => t.title.toLowerCase().includes(q));
    }
    return filtered.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, completed: t.completed, priority: t.priority }));
  },

  create_task: async (userId, args) =>
    createTaskForUser(userId, {
      title: String(args.title ?? ""),
      dueAt: typeof args.dueAt === "string" ? args.dueAt : null,
      priority: typeof args.priority === "string" ? args.priority : undefined,
      description: typeof args.description === "string" ? args.description : null,
    }),

  propose_task: async () => ({ noted: true }),

  complete_task: async (userId, args) => completeTaskForUser(String(args.id ?? ""), userId),

  search_promises: async (userId, args) => {
    const results = await searchPromisesForUser(userId, {
      query: typeof args.query === "string" ? args.query : undefined,
      status: typeof args.status === "string" ? args.status : undefined,
    });
    return results.map((p) => ({
      id: p.id,
      commitment: p.commitment,
      direction: p.direction,
      personName: p.personName,
      personEmail: p.personEmail,
      dueAt: p.dueAt,
      status: p.derivedStatus,
    }));
  },

  create_promise: async (userId, args) =>
    createPromiseForUser(userId, {
      direction: String(args.direction ?? "OUTGOING"),
      commitment: String(args.commitment ?? ""),
      personName: typeof args.personName === "string" ? args.personName : null,
      personEmail: typeof args.personEmail === "string" ? args.personEmail : null,
      dueAt: typeof args.dueAt === "string" ? args.dueAt : null,
    }),

  propose_promise: async () => ({ noted: true }),

  search_calendar: async (userId, args) => {
    const all = await getTasksForUser(userId);
    const from = typeof args.fromDate === "string" ? new Date(args.fromDate) : new Date();
    const to = typeof args.toDate === "string" ? new Date(args.toDate) : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    return all
      .filter((t) => t.dueAt && t.dueAt >= from && t.dueAt <= to)
      .map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, completed: t.completed }));
  },
};

export async function runAssistant(userId: string, turns: ChatTurn[]): Promise<ChatResult> {
  return runToolLoop(userId, turns, {
    chatFn: chatWithTools,
    handlers: TOOL_HANDLERS,
    tools: TOOL_DEFS,
    systemPrompt: SYSTEM_PROMPT,
  });
}
