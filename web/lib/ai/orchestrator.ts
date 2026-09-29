import { chatText, chatWithTools, type ChatFn, type ChatMessage, type ToolDef } from "./nvidia";
import { searchEmailsForUser, loadOwnedEmail } from "@/lib/emails";
import { emailBodyText } from "@/lib/email-text";
import { getTasksForUser, createTaskForUser, completeTaskForUser } from "@/lib/tasks";
import { searchPromisesForUser, createPromiseForUser } from "@/lib/promises";
import { localNaiveToUtcIso } from "@/lib/ai/local-datetime";
import type { ChatResult, ChatTurn, Citation, ProposedAction } from "./orchestrator-shared";

// The model reasons about dates as local wall-clock time ("tomorrow",
// "next Friday"), so every date it's asked for is a LOCAL naive datetime
// ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss", no timezone suffix) — same
// convention lib/ai/parse-task.ts already uses — converted to a real UTC
// instant here via pure arithmetic rather than asking the model to also
// get the UTC conversion right. Returns null (not a throw) for anything
// that isn't a non-empty, parseable date string, so a malformed date from
// the model degrades to "no date" instead of crashing the tool call.
export function toUtcIso(value: unknown, timezoneOffsetMinutes: number): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const naive = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  try {
    return localNaiveToUtcIso(naive, timezoneOffsetMinutes);
  } catch {
    return null;
  }
}

// A small 11B instruct model under tool_choice:"auto" with ten tools on
// offer reliably ignores a "don't call a tool for a bare greeting" prompt
// instruction — verified live, it still burns the whole iteration budget
// searching for something to do with "hi" (and once, for "hello tomy"
// before this pattern covered it, actually called complete_task on an
// unrelated task — a greeting must never reach a write tool). Prompt
// wording alone isn't reliable enough here, so greetings/small talk are
// routed around the tool loop entirely by a deterministic match instead.
// Deliberately a narrow whitelist of near-exact phrases, not a "message is
// short" check — a short real question ("tasks?") must still reach the
// tools.
const CHITCHAT_PATTERNS: RegExp[] = [
  /^h(i+|ey+|ello+)( there)?(,? tomy)?$/,
  /^(good )?(morning|afternoon|evening|night)$/,
  /^how('s| is| are) (it going|things|you( doing)?)$/,
  /^what'?s up$/,
  /^sup$/,
  /^yo$/,
  /^(thanks|thank you|thx|ty)$/,
  /^(ok|okay|cool|nice|great|awesome|got it|sounds good)$/,
  /^(lol|haha)$/,
  /^(bye|goodbye|see ya|see you|later)$/,
];

export function isChitChat(message: string): boolean {
  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  return CHITCHAT_PATTERNS.some((re) => re.test(normalized));
}

// Live-reproduced: forced onto tool_choice: "none" with nothing left to
// call, this model sometimes writes out the tool call it still wanted to
// make as a JSON blob instead of actually answering — e.g. exactly
// {"name": "search_emails", "parameters": {"query": "respond"}}. Parses as
// valid JSON but is never a real answer, so it's detected structurally
// (object with a "name" plus "parameters"/"arguments") rather than by
// guessing at wording — a real answer that happens to mention JSON data in
// prose ("...total is {\"amount\": 245}...") isn't itself valid JSON when
// parsed whole, so it doesn't match.
export function isLeakedToolCall(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.name === "string" &&
      ("parameters" in parsed || "arguments" in parsed)
    );
  } catch {
    return false;
  }
}

export type { ChatResult, ChatTurn, Citation, ProposedAction } from "./orchestrator-shared";

export type ToolHandlerMap = Record<string, (userId: string, args: Record<string, unknown>) => Promise<unknown>>;

const DEFAULT_MAX_ITERATIONS = 6;

const COULDNT_FINISH_MESSAGE =
  "Hmm, that one got away from me — I went down a rabbit hole and didn't land on an answer. Mind asking it again, maybe a bit more specific? I'll get it this time!";

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
    // On the last allowed round, force a text answer instead of letting the
    // model spend it on yet another tool call. Verified live against this
    // model: with ten tools always on offer, it doesn't reliably self-limit
    // on prompt wording alone — for a scattered enough question it burns
    // every iteration calling tools and never gets a turn to answer,
    // landing on the generic fallback below even though it had gathered
    // real citations along the way. tool_choice: "none" makes that
    // impossible: the model can't call anything, so it must synthesize
    // from whatever's already in the transcript.
    const isFinalRound = i === maxIterations - 1;
    const result = await opts.chatFn({
      messages,
      tools: opts.tools,
      maxTokens: 700,
      toolChoice: isFinalRound ? "none" : "auto",
    });

    if ("content" in result) {
      // A "content" response the model gave while it still wanted to call a
      // tool (see isLeakedToolCall) is not an answer — never show it as one.
      const message = isLeakedToolCall(result.content) ? COULDNT_FINISH_MESSAGE : result.content;
      return { message, citations: [...citations.values()], actions };
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
      let succeeded = false;
      try {
        const raw = call.rawArguments ? JSON.parse(call.rawArguments) : {};
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
          throw new Error("tool arguments must be a JSON object");
        }
        parsedArgs = raw as Record<string, unknown>;
        const handler = opts.handlers[call.name];
        if (!handler) throw new Error(`unknown tool: ${call.name}`);
        output = await handler(userId, parsedArgs);
        succeeded = true;
      } catch (err) {
        output = { error: err instanceof Error ? err.message : "tool call failed" };
      }

      // Only a successful call's result becomes a citation or a suggested
      // action — a failed search shouldn't cite anything, and a failed
      // propose_* shouldn't leave the user a button that POSTs empty/garbage
      // params and can never succeed.
      if (succeeded) {
        collectCitations(call.name, output, citations);
        collectProposedAction(call.name, parsedArgs, actions);
      }

      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
    }
  }

  return {
    message: COULDNT_FINISH_MESSAGE,
    citations: [...citations.values()],
    actions,
  };
}

function buildSystemPrompt(localNow: Date): string {
  const today = localNow.toISOString().slice(0, 10);
  const weekday = localNow.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return `You are Tomy, TrueMail's AI assistant — warm, friendly, and a little playful, like a sharp colleague who happens to have read the user's whole inbox.

MOST IMPORTANT RULE, CHECK THIS FIRST: if the user's message is just a greeting, thanks, small talk, or anything else that isn't actually a question about their email/tasks/promises/schedule ("hi", "hello", "hey", "how are you", "thanks!", "good morning", "lol", "ok", "cool") — do NOT call any tool. Just reply in one short, warm, natural sentence, the way a friendly colleague passing in the hallway would, and stop there. Calling a tool for a plain greeting is a mistake — there is nothing to look up.

Only once the user asks something that actually needs their TrueMail data do the tools below come in. You have tools to search and read the user's emails, and to search, create, and complete their tasks and promises, and to look up their calendar (scheduled tasks — TrueMail has no separate events model, a task with a due date is a calendar entry).

Today's date is ${today}, a ${weekday}. Resolve relative dates ("tomorrow", "next Friday", "this week") against that. Whenever a tool takes a date (dueAt, fromDate, toDate), give it as a LOCAL date or datetime — "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss" — never UTC, never with a timezone suffix.

Rules:
- Stay in the domain the question is actually about. A question about emails only needs search_emails/get_email — don't also check the calendar, tasks, or promises just because a word like "today" appears. A question about tasks only needs the task tools, and so on. Only reach across domains when the user's question genuinely spans them (e.g. "turn my unread emails into tasks").
- One search_emails call is usually enough — it already returns subject, sender, and a snippet for up to 20 emails, which is normally enough to judge and answer from. Only call get_email when you need one specific email's full body, and only call search_emails again if the first call's results genuinely don't cover the question (a different folder, a different keyword) — never repeat the same kind of search hoping for a different result.
- For a broad question ("what emails need a reply", "what's new", "anything important") don't invent a narrow query keyword to search for — words like "respond" or "reply" describe what the USER wants to do, they're not text that appears in the emails themselves, and searching for them finds nothing. Call search_emails with no query at all to get the most recent emails, then use your own judgment on which ones matter. Only pass a query when the user actually named something to search for (a person, a subject, a project).
- If a tool call comes back empty or unhelpful, that's information too — don't call the exact same tool with the exact same arguments again hoping for a different result. Either try a genuinely different approach (a broader search, no filter at all) or answer with what you have, honestly noting what you didn't find.
- For a real question about the user's data, call a tool to look it up before answering. Never guess or invent information.
- Write like you're talking to a person, not filing a report: contractions are fine, a little personality is good, but stay clear and get to the point — no corporate throat-clearing.
- Never mention tool or function names, or say that you're "calling a tool" — just do it and talk about what you found.
- Only call create_task, create_promise, or complete_task when the user has explicitly asked for that specific action in this message. Never call one of these as a side effect of exploring, searching, or answering something else — if you're not sure the user asked for it, don't call it. When you are just listing or summarizing things you found, call propose_task or propose_promise instead for each one you'd suggest (or make no such call if there's nothing worth suggesting) — never call both a create and a propose tool for the same thing in one turn.
- When you use information from a specific email to answer, make sure you reached it via search_emails or get_email so its source can be shown to the user.
- Keep answers concise — a few sentences, not an essay.`;
}

const LOCAL_DATE_DESC = 'Local date, "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss" — never UTC, never with a timezone suffix.';

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
        dueAt: { type: "string", description: LOCAL_DATE_DESC },
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
        dueAt: { type: "string", description: LOCAL_DATE_DESC },
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
        dueAt: { type: "string", description: LOCAL_DATE_DESC },
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
        dueAt: { type: "string", description: LOCAL_DATE_DESC },
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
        fromDate: { type: "string", description: `${LOCAL_DATE_DESC} Defaults to today.` },
        toDate: { type: "string", description: `${LOCAL_DATE_DESC} Defaults to fromDate (i.e. just that one day).` },
      },
    },
  },
];

function buildToolHandlers(timezoneOffsetMinutes: number): ToolHandlerMap {
  return {
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
      dueAt: toUtcIso(args.dueAt, timezoneOffsetMinutes),
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
      dueAt: toUtcIso(args.dueAt, timezoneOffsetMinutes),
    }),

  propose_promise: async () => ({ noted: true }),

  // fromDate/toDate default to today (local) and the end date is treated
  // as inclusive of that whole local day — "what's on my calendar
  // tomorrow" with fromDate===toDate should match tasks due any time
  // during that day, not just at exactly local midnight.
  search_calendar: async (userId, args) => {
    const all = await getTasksForUser(userId);
    const localNow = new Date(Date.now() - timezoneOffsetMinutes * 60000);
    const todayLocal = localNow.toISOString().slice(0, 10);
    const fromArg = typeof args.fromDate === "string" && args.fromDate.trim() ? args.fromDate : todayLocal;
    const toArg = typeof args.toDate === "string" && args.toDate.trim() ? args.toDate : fromArg;
    const fromIso = toUtcIso(fromArg, timezoneOffsetMinutes);
    const toIso = toUtcIso(/^\d{4}-\d{2}-\d{2}$/.test(toArg) ? `${toArg}T23:59:59` : toArg, timezoneOffsetMinutes);
    if (!fromIso || !toIso) return { error: "invalid date" };
    const from = new Date(fromIso);
    const to = new Date(toIso);
    return all
      .filter((t) => t.dueAt && t.dueAt >= from && t.dueAt <= to)
      .map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, completed: t.completed }));
  },
  };
}

export async function runAssistant(userId: string, turns: ChatTurn[], timezoneOffsetMinutes = 0): Promise<ChatResult> {
  // Routed around the tool loop entirely (see isChitChat's comment) rather
  // than relying on the model to decline every tool for a bare "hi".
  const lastTurn = turns.at(-1);
  if (lastTurn?.role === "user" && isChitChat(lastTurn.content)) {
    const reply = await chatText({
      system:
        "You are Tomy, TrueMail's AI assistant — warm, friendly, and a little playful. The user just said something conversational (a greeting, thanks, or small talk), not a question about their email, tasks, promises, or schedule. Reply in one short, natural sentence, the way a friendly colleague passing in the hallway would.",
      user: lastTurn.content,
      maxTokens: 60,
      temperature: 0.7,
    });
    return { message: reply, citations: [], actions: [] };
  }

  const localNow = new Date(Date.now() - timezoneOffsetMinutes * 60000);
  return runToolLoop(userId, turns, {
    chatFn: chatWithTools,
    handlers: buildToolHandlers(timezoneOffsetMinutes),
    tools: TOOL_DEFS,
    systemPrompt: buildSystemPrompt(localNow),
  });
}
