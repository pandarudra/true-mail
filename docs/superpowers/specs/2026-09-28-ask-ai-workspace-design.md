# Ask AI — Workspace Assistant (Phase 1) — Design Spec

Status: Approved by user 2026-09-28. Ready for implementation planning.

## 1. Scope

The user's brief (pasted from an external brainstorm) bundles five
independently-shippable pieces: (a) a tool-calling chat core over
emails/tasks/promises/calendar with citations and actionable results, (b)
persisted multi-thread conversation history with a sidebar, (c) a
per-email "Ask AI" entry point with context chips, (d) file/document
attachments, (e) write actions with external side effects (`send_email`,
`create_draft`). Confirmed with the user: **this spec covers (a) only.**
(b)–(e) are follow-up phases, sequenced but not designed here.

Phase 1 delivers the actual differentiator called out in the brief: not
"ChatGPT inside TrueMail" but an assistant that calls real tools against
the user's own data and shows its work (citations), rather than a prompt
stuffed with context and hoped-for JSON.

Explicitly in scope:
- A new `/ai` page with a ChatGPT-style (but visually native-to-TrueMail)
  conversation view.
- A tool-calling orchestrator that can search/read emails, and
  search/create/complete tasks and promises, calendar-range queries over
  tasks.
- Citations back to source emails.
- Actionable buttons for AI-*suggested* (not yet executed) creates.
- Multi-turn conversation, in-memory for the current page visit only.

Explicitly out of scope (deferred, not designed):
- Persisted conversation history / thread sidebar.
- The in-email "Ask AI" entry point and context chips (`[Emails] [Tasks]
  [Promises] [Calendar]` filters).
- File/document attachments.
- `send_email`, `create_draft`, `search_contacts` (no Contact model to
  back the last one).
- Streaming responses (confirmed with user: a "Thinking…" state + full
  answer at once, matching every existing AI route in this codebase).

No AI call ever runs automatically or in the background — same posture as
the existing AI features spec. Every message is triggered by the user
typing and sending.

## 2. Architecture

One extension to the existing NVIDIA client, one new orchestrator module,
one new API route, one new `lib/emails.ts` (fills a real gap — email
queries are currently ad-hoc `prisma.email.*` calls scattered across
routes; every other domain already has this file). No new database
tables — nothing is persisted; the client resends the full in-memory
conversation each turn.

**Model**: same `meta/llama-3.2-11b-vision-instruct` via NVIDIA's
OpenAI-compatible endpoint already used everywhere else in this codebase.
**Verified live against the project's actual `NVIDIA_API_KEY`** (not
assumed from docs) that this model/key supports real OpenAI-style
function calling — a `tools` request returns clean `tool_calls`, and
feeding a `tool` role message back produces a coherent natural-language
synthesis. This is the basis for choosing native tool-calling over a
hand-rolled JSON-prompt ReAct loop: it's the standard, better-understood
mechanism, and it's confirmed to work with what this project already
pays for.

## 3. Components

### `lib/ai/nvidia.ts` (extend — existing `chatText`/`chatJSON` untouched)

```ts
type ToolDef = {
  name: string;
  description: string;
  parameters: object; // JSON Schema, passed through to the API
};

type ToolCall = { id: string; name: string; args: unknown };

async function chatWithTools(opts: {
  system: string;
  messages: { role: "user" | "assistant" | "tool"; content: string; tool_call_id?: string }[];
  tools: ToolDef[];
  maxTokens: number;
}): Promise<{ content: string } | { toolCalls: ToolCall[] }>
```

Thin wrapper over the same `fetch` pattern `complete()` already uses, with
`tools`/`tool_choice: "auto"` added to the request body and `tool_calls`
read off the response alongside `content`. The orchestrator (below) owns
the loop; this function makes exactly one request/response round trip.

### `lib/ai/orchestrator.ts` (new)

```ts
export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatResult = {
  message: string;
  citations: { emailId: string; from: string; subject: string; snippet: string }[];
  actions: { type: "create_task" | "create_promise"; label: string; params: Record<string, unknown> }[];
};

export async function runAssistant(userId: string, turns: ChatTurn[]): Promise<ChatResult>
```

Owns the tool-call loop (max 6 iterations — enough for a multi-step
"search emails → search promises → summarize" chain without risking a
runaway/looping model): call `chatWithTools`, execute any returned tool
calls against the registry below, append results as `tool` messages,
repeat until the model returns plain `content`. Citations are accumulated
from every `search_emails`/`get_email` tool result actually returned
during the loop (**never trusted from the model's own text** — same
"filter against what was actually in context" rule the existing
`/api/ai/ask` route already follows) and de-duped by `emailId` before
being attached to the final result.

The system prompt is the one place behavior nuance lives: instructs the
model (1) to answer naturally and never mention tool/function names, (2)
to call `create_task`/`create_promise` only when the user has *explicitly*
asked for something to be created — when merely listing/summarizing
found items, describe them and end the turn; the client-side UI (§ below)
renders the "create all as tasks"-style buttons from `actions`, which the
model fills in only in that describing-not-doing case, and (3) to always
prefer a tool call over guessing when a question needs current data.

Tool registry (all scoped by `userId`, thin wrappers — no raw Prisma in
this file):

| Tool | Backing function | Notes |
|---|---|---|
| `search_emails(query?, folder?, limit?)` | new `lib/emails.ts` | across all of the user's mailboxes; `limit` capped at 20 server-side regardless of what the model requests |
| `get_email(id)` | new `lib/emails.ts` | ownership-checked the same way `loadOwnedEmail` already does everywhere |
| `search_tasks(query?, status?)` | **new** `getTasksForUser` in `lib/tasks.ts` | today task listing is inline `prisma.task.findMany` in `app/api/tasks/route.ts`'s `GET` (verified while writing this spec — no reusable function exists yet, unlike promises/emails). This adds one, `status`: `all \| pending \| completed \| overdue`, and the route gets a one-line edit to call it too instead of duplicating the query |
| `create_task(title, dueAt?, priority?, description?)` | existing `createTaskForUser` | no `listId` param exposed to the model — always the user's default list, matching what "just create a task" means in every other entry point |
| `complete_task(id)` | **new** `completeTaskForUser` in `lib/tasks.ts` | today this branch (recurring task → `completeRecurringOccurrence`, else plain `completed`/`completedAt` update) is inline in `app/api/tasks/[id]/route.ts`'s `PATCH`. Extracting it is a real prerequisite here, not scope creep — the tool needs the exact same recurring-vs-plain behavior a checkbox click gets, and the route gets refactored to call the extracted function too rather than ending up with two copies of that branch |
| `search_promises(query?, status?)` | new thin wrapper over `getPromisesForUser`, filtered client-side-in-the-function by a simple substring match on `commitment` when `query` given | |
| `create_promise(direction, commitment, personName?, personEmail?, dueAt?)` | existing `createPromiseForUser` | |
| `search_calendar(fromDate, toDate)` | same task query as `search_tasks`, `dueAt` range-filtered | confirmed no separate Events model — tasks with `dueAt` are the calendar |

### `lib/emails.ts` (new)

Fills the established-elsewhere-but-missing-here convention
(`EMAIL_INCLUDE`, a `getX`/`searchX` pair), used by both the new AI tools
and — free bonus, not required by this spec but noted since it's the
same file — available for any future route that wants it instead of
another ad-hoc `prisma.email.*` call.

```ts
export async function searchEmailsForUser(userId: string, opts: { query?: string; folder?: string; limit?: number }): Promise<EmailSummary[]>
export async function loadOwnedEmail(id: string, userId: string): Promise<Email | null>
```

`searchEmailsForUser` matches `subject`/`from`/`text` with a
case-insensitive `contains`, scoped to `mailbox: { userId }` (all of the
user's mailboxes, not one) — matches the existing `/api/ai/ask` route's
"a real question cuts across labels/folders" reasoning.

### API route (new)

**`POST /api/ai/chat`** — body `{ messages: { role: "user" | "assistant", content: string }[] }`
(the client sends the running conversation; nothing is persisted
server-side). `getUserId(req.headers)` → 401 if none, same as every other
route. Calls `runAssistant(userId, messages)`, returns the `ChatResult`
as-is. NVIDIA failure/timeout → 502 `{ error: "AI is temporarily
unavailable. Please try again." }`, same convention as every other AI
route.

### UI (new)

Icons are Phosphor throughout, no emoji anywhere (including in any
example text shown to or generated by the model) — matches the existing
AI-features convention exactly.

- **`app/(app)/ai/page.tsx` + `AskAiClient.tsx`** — new route, added to
  `Sidebar.tsx`'s Productivity group using a `Sparkle` icon (deliberately
  distinct from the `Robot` icon the existing inbox-only `AskInbox`
  popover uses — that component is untouched, stays as the small
  inbox-scoped quick-ask it already is; this is a separate, bigger
  surface).
- **Empty state**: centered heading ("Ask AI"), subtitle, the composer,
  and four quick-start cards (Emails / Tasks / Promises / Calendar) using
  the same icons already used for those concepts elsewhere
  (`Envelope`/`ListChecks`/`Handshake`/`CalendarBlank`). Clicking a card
  prefills the composer with a starter question — doesn't auto-send.
- **Conversation view**: user turns as a right-aligned pill; assistant
  turns as plain text blocks (no heavy bubble chrome, matching this app's
  generally chrome-light aesthetic more than a literal ChatGPT clone). A
  "Thinking…" label while awaiting the response — no streaming.
- **Citations**: small `DrawablyCard` rows under the answer text —
  subject, sender, date, one-line snippet, "Open email" link to
  `/inbox?emailId=...` (same pattern `PromiseDetailDialog` already uses
  for its source-email link).
- **Actions**: buttons rendered from the response's `actions` array only
  (e.g. "Create all as tasks", or per-item creates) — these are *client-
  initiated* direct calls to the existing `POST /api/tasks` / `POST
  /api/promises` routes with the params the model proposed, not a second
  AI round-trip. Once clicked, the button shows a checked/done state
  (local component state) rather than re-rendering the whole turn.
- **State**: the running conversation (`ChatTurn[]`) lives in the page
  component's own `useState` — no Zustand store, since nothing else in
  the app reads or writes it and it's explicitly ephemeral until Phase 2
  adds persistence.

## 4. Error handling

Same posture as the rest of the AI feature set: NVIDIA failure → 502 with
a friendly message, rendered inline in the chat as a plain assistant-style
error turn (not a crash, not a toast) so the conversation stays scrollable
and the user can just try again. A tool handler throwing (e.g. a
malformed date from the model) is caught *inside* the orchestrator loop
and turned into a `tool` role error message fed back to the model
("that action failed: <reason>") rather than aborting the whole turn —
gives the model a chance to recover (retry with corrected args, or explain
the failure to the user) instead of a hard 502 for a single bad tool call.
The iteration cap (6) still bounds worst case.

## 5. Security

Every tool is scoped by `userId` taken from the session, never from
anything the model outputs — the model cannot name a different user or
mailbox and get their data; it only ever gets a `userId` closure it
never sees directly. `create_task`/`create_promise` go through the exact
same validated `createTaskForUser`/`createPromiseForUser` functions the
existing REST routes use, so the same input validation (empty title,
invalid priority, etc.) applies — no separate, weaker validation path for
AI-initiated writes.

## 6. Docs

- `public/openapi.json` gets the new `POST /api/ai/chat` path documented,
  tagged `AI`, following the existing schema conventions in that file.

## 7. Explicit cuts (and why)

- **No persistence.** Confirmed with user — Phase 2. Keeping Phase 1's
  `/api/ai/chat` stateless (client resends the transcript) also means
  Phase 2 can add persistence without changing this route's contract
  much — it becomes "load the thread, append, save" wrapped around the
  same `runAssistant` call.
- **No streaming.** Confirmed with user — every existing AI route in this
  codebase is single-shot; adding SSE plumbing for one feature is real
  new infrastructure with no functional requirement behind it yet.
- **No `send_email`/`create_draft` tools.** The brief itself says "don't
  silently send emails" and wants a review step before anything
  externally visible goes out — that review UI (draft-and-confirm inside
  the chat) is its own design surface, not a one-line addition to this
  one.
- **No `search_contacts`.** No `Contact` model exists; deriving one from
  `Promise.personName`/`personEmail` + email `from`/`to` fields is a
  real (if small) data-model question that deserves its own look, not a
  drive-by decision inside this spec.
- **No embeddings/vector search**, same reasoning as the existing AI
  features spec — not reachable with the current NVIDIA key;
  `search_emails`'s `contains` matching plus the model's own multi-step
  tool use (search, then search again with different terms) is the
  right-sized substitute at today's scale.

## 8. Testing

`lib/ai/orchestrator.test.ts` — the tool-loop control flow is the one
piece of genuinely new logic worth testing directly: the max-iteration
cap actually stops the loop, a tool error becomes a `tool` role message
rather than throwing, and citation de-duplication works. NVIDIA calls
mocked via `fetch`, same approach `lib/ai/nvidia.test.ts` (existing)
already uses for `chatJSON`. `lib/emails.ts`'s query functions don't get
their own test file — thin Prisma wrappers, same as `lib/tasks.ts`/
`lib/promises.ts`'s equivalents, which also have no dedicated query
tests (only the pure derived-status/percentage functions are tested).
