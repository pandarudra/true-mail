# TrueMail AI Features V1 — Design Spec

Status: Approved by user 2026-09-20. Ready for implementation planning.

## 1. Scope

V1 of the "holy trinity" from the user's AI roadmap, adapted to what the
current data model and NVIDIA key actually support:

1. **Summarize** — condense a single open email into bullets + one action
   item. (Not multi-message "thread" summary — TrueMail has no threading
   model today; see §6.)
2. **AI Reply** — pick an intent (Accept / Decline / Ask for details / Thank
   them / Follow up / Custom) and get a drafted reply body, opened in the
   existing compose flow for review before sending.
3. **Ask Your Inbox** — natural-language question over the current
   mailbox's recent mail, answered with cited emails you can jump to.

Explicitly out of scope for V1 (all 12 remaining items from the roadmap:
triage/categorization, priority scoring, follow-up detection, newsletter
cleanup, calendar extraction, structured-data extraction, phishing
detection, tone detection, rewrite, the AI agent, personal writing-style
memory, daily briefing). Nothing here is designed to block any of them
later — the NVIDIA client and email-text helper are the reusable seams.

No AI call ever runs automatically or in the background. Every feature is
triggered by an explicit user action (button press or typed question) —
worth stating plainly given TrueMail's "your infrastructure stays yours"
pitch: email content only leaves the server when the user asks it to.

## 2. Architecture

One server-side NVIDIA client, three thin API routes, three small client
components. No new database tables — nothing AI-generated is persisted or
cached; every call is regenerated fresh on request.

- **Model**: `meta/llama-3.2-11b-vision-instruct` via NVIDIA's
  OpenAI-compatible endpoint (`https://integrate.api.nvidia.com/v1`),
  hardcoded as a constant, not env-configurable — this is the only chat
  model confirmed to work with the project's `NVIDIA_API_KEY` and to follow
  strict-JSON instructions cleanly (verified live against the account: most
  of the public catalog, including every embedding model, 404s for this
  key). No new env var beyond the `NVIDIA_API_KEY` that's already in
  `.env`; it's missing from `.env.example` and gets added there.
- **No embeddings / no vector DB**: since no embedding model is reachable
  with this key, "Ask Your Inbox" uses context-stuffing instead of semantic
  search — the model is handed a compact list of recent emails directly.
  Fine at personal-inbox scale; revisit if/when an embedding model becomes
  available or mailbox sizes make this impractical.
  <!-- ponytail: context-stuffing over ~60 recent emails, switch to
  embeddings + pgvector if mailboxes grow past a few thousand messages and
  answers start missing older mail -->

## 3. Components

### `lib/ai/nvidia.ts` (new)

```ts
async function chatText(opts: { system: string; user: string; maxTokens: number; temperature?: number }): Promise<string>
async function chatJSON<T>(opts: { system: string; user: string; maxTokens: number; temperature?: number }): Promise<T>
```

Both POST to `/chat/completions` with the hardcoded model and
`Authorization: Bearer ${process.env.NVIDIA_API_KEY}`. `chatJSON` strips a
leading/trailing ` ```json ` fence if present, then `JSON.parse`s the
result; throws a descriptive error on a non-2xx response or invalid JSON
so callers can turn it into a clean 502. Every prompt sent to the model
instructs it to reply with JSON only where structure is needed
(summarize, ask) or plain text only (reply draft) — no markdown, no
chain-of-thought.

### `lib/email-text.ts` (new)

```ts
function emailBodyText(email: { text: string | null; html: string | null }): string
```

Prefers `text`; falls back to `html` with tags stripped via a regex (no
new dependency); falls back to `""`. Shared by all three routes.

### API routes (new)

All three follow the existing route convention exactly: `getUserId(req.headers)` →
401 if none, then an ownership-scoped Prisma lookup → 404 if not found/not
owned, matching every other route in `app/api/`.

- **`POST /api/ai/summarize`** — body `{ emailId }`. Loads the email
  (`mailbox: { userId }` scoped, like `loadOwnedEmail` in
  `app/api/emails/[id]/route.ts`). Prompt: system message instructs
  strict-JSON `{ summary: string, bullets: string[], action: string | null }`;
  user message is subject/from/date/body via `emailBodyText`. `max_tokens`
  300, `temperature` 0.2.
- **`POST /api/ai/reply`** — body `{ emailId, intent, customInstruction? }`
  where `intent` is one of `accept | decline | ask_details | thank |
  follow_up | custom` (`customInstruction` required only when
  `intent === "custom"`, 400 otherwise). Prompt instructs a plain-text
  reply body only, 2-4 sentences, matching the sender's tone loosely, no
  greeting/signature boilerplate beyond what the intent implies. Returns
  `{ text: string }`. `max_tokens` 200, `temperature` 0.4.
- **`POST /api/ai/ask`** — body `{ mailboxId, question }`. Ownership-checks
  the mailbox, then loads up to 60 most-recent emails in that mailbox
  (`trashedAt: null, spam: false`, both directions, all folders — a real
  question like "which invoices are unpaid" cuts across labels) reduced to
  `{ id, from, to, subject, createdAt, snippet: emailBodyText(...).slice(0, 200) }`.
  Prompt asks for strict JSON `{ answer: string, citedEmailIds: string[] }`.
  **The route filters `citedEmailIds` down to ids that were actually in the
  context set before returning** — the model's citations are never trusted
  blindly, closing off both hallucinated ids and any theoretical
  cross-mailbox leakage. `max_tokens` 500, `temperature` 0.2.

### UI components (new)

Icons throughout are Phosphor (`@phosphor-icons/react`), matching every
existing icon in the app — no emoji glyphs anywhere in the UI, including
in prompts' example output shown to the model (the model's own JSON
fields are plain text/strings, not emoji-decorated).

- **`components/ai/SummaryCard.tsx`** — a `Sparkle`-icon "Summarize"
  button (styled like other `IconButton`/`Button` usages) inside
  `ReadingPane`, above the email body. Click → loading state → renders
  `summary` as a short paragraph, `bullets` as a plain list, and `action`
  (if non-null) as a single highlighted line. Collapsible: a second click
  on an already-loaded summary just toggles visibility (no re-fetch).
- **`components/ai/AiReplyBar.tsx`** — a row of pill buttons next to the
  existing Reply/Reply all/Forward actions in `ReadingPane`: `Check`
  (Accept), `X` (Decline — already imported in that file), `Question` (Ask
  for details), `ThumbsUp` (Thank them), `Clock` (Follow up), and
  `PencilSimpleLine` (Custom — reusing the same icon Sidebar already uses
  for "Compose", for visual consistency of "write something"). Custom
  reveals a small inline text input + a send icon button. Any pill click
  fetches the draft, then:
  1. `sessionStorage.setItem("truemail:ai-draft", text)`
  2. `router.push(`/compose?replyTo=${email.id}&mode=reply`)` — the exact
     existing navigation, unchanged.
  `ComposeClient` (existing file, small edit): right after its existing
  `resetForSession` call (inside the `if (lastKey !== sessionKey)` block),
  reads and clears `sessionStorage.getItem("truemail:ai-draft")`; if
  present, calls `useComposeStore.getState().setText(aiDraft + "\n\n" +
  useComposeStore.getState().text)` to place the AI draft above the
  existing quoted-original text that `resetForSession` already populated.
  No change to the compose page's server contract, no URL length concerns
  from passing generated text as a query param.
- **`components/ai/AskInbox.tsx`** — a `Sparkle` icon button inside
  `TopBar`'s existing search box (next to the `MagnifyingGlass` icon)
  toggles the input into "ask" mode (placeholder changes to "Ask your
  inbox..."). Enter submits the question; a panel renders below the bar
  with the `answer` text and the cited emails as clickable chips
  (`from` + `subject`, styled like existing `DrawablyBadge` chips
  elsewhere in the app). Clicking a chip calls the inbox store's existing
  `selectEmail(id)` — same action a normal message-list row click uses —
  to open it in the Reading Pane. A second click on the `Sparkle` toggle
  reverts to normal live search.

## 4. Error handling

NVIDIA failure, timeout, or 429 → route returns 502 with
`{ error: "AI is temporarily unavailable. Please try again." }`; no
retry/backoff (single free-tier key, not worth the complexity for a V1
feature layer). Client-side, each component shows that message inline
where its result would otherwise appear — same pattern the rest of the
app already uses for API errors (`readError` + an inline `text-red-600`
line).

## 5. Docs

- `.env.example` gets `NVIDIA_API_KEY=""` added (currently missing).
- `public/openapi.json` gets the three new `/api/ai/*` paths documented,
  tagged `AI`, following the exact schema/response conventions already
  used for every other route in that file.

## 6. Explicit cuts (and why)

- **No real threading.** Building subject/participant-based conversation
  grouping (even a lightweight one) is a data-model change orthogonal to
  AI — it's useful on its own regardless of AI, and bundling it into this
  feature would double the review surface for no V1 benefit. Summarize
  works on the single open email instead.
- **No embeddings/vector search.** Not reachable with the current NVIDIA
  key; context-stuffing is the right-sized substitute at today's mailbox
  scale (see §2).
- **No caching or persistence of AI output.** Every summary/reply/answer
  is generated fresh. Simpler, and avoids the question of invalidating a
  cached summary when an email gets relabeled/replied-to.
- **No rate limiting.** Single-user or small-instance deployments don't
  need it yet; add it if TrueMail ever runs multi-tenant at real scale.

## 7. Testing

One new vitest file, `lib/ai/nvidia.test.ts`, covering `chatJSON`'s fence
stripping and its error path on invalid JSON (mocked `fetch`) — the one
piece of genuinely new parsing logic. Everything else is thin glue over
already-tested Prisma queries (ownership scoping, `emailBodyText`) and
existing UI patterns (buttons, inline errors, `DrawablyBadge` chips),
which don't need their own new test files.
