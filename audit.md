Build Plan

[Architecture](#arch) [Phases](#phases) [Timeline](#timeline)

TrueMail Agent · No-Bedrock E2E Build Plan

# Everything to build, start to finish

NVIDIA NIM stays as the AI provider. Amazon Bedrock is skipped. All other hackathon requirements — MCP server, Streamable HTTP, Alexa+ UI, open source — are covered here.

⚠ Skipping: Amazon Bedrock, AWS credentials, IAM, Phase 6 (AWS Builder)

7

MCP tools to build

6

Build phases

\~16h

Estimated dev time

0

Files to break (existing app unchanged)

## Architecture

Two processes, one codebase. The existing TrueMail web server gains an internal auth middleware; the new MCP server calls it as a privileged client.

Data flow — Alexa+ query to result

Browser (Alexa+ page: /agent) │ POST /api/agent {messages, timezoneOffsetMinutes} │ cookie: better-auth session ▼ Next.js /api/agent (NEW route — port 3000) │ getUserId() → userId ✓ │ runToolLoop(userId, turns, {chatFn: nvidia, handlers: mcpHandlers}) │ ↳ same orchestrator loop, different handlers ▼ MCP Client (@modelcontextprotocol/sdk client) │ POST http://localhost:3001/mcp │ Headers: X-Internal-Secret, X-User-Id ▼ MCP Server (mcp/ — port 3001, NEW standalone process) │ validates X-Internal-Secret │ extracts userId from X-User-Id │ dispatches tool call ▼ TrueMail REST API (existing routes — port 3000) │ X-Internal-Key + X-User-Id headers │ new internal auth middleware accepts these ▼ lib/ functions → Prisma → PostgreSQL │ └── Resend (for send_email / reply_email)

Auth chain — two new mechanisms needed

1\. MCP Server trust /api/agent → MCP server Header: X-Internal-Secret: $MCP_SHARED_SECRET (shared env var) Header: X-User-Id: \<userId from session> MCP server rejects any request without matching secret. 2. TrueMail internal auth (new middleware in web/) MCP server → TrueMail /api/\* Header: X-Internal-Key: $INTERNAL_API_KEY (shared env var) Header: X-User-Id: \<userId> Middleware: if both headers valid → skip normal session check, inject userId as if it came from session.

**Why not call TrueMail lib functions directly?** The MCP server is a separate Node.js process in `mcp/`. It can't import from `web/lib` (different runtime, Next.js internals). Calling TrueMail's own REST API keeps it clean and makes the MCP server genuinely reusable for the open-source story.

## Build Phases

Each phase is self-contained. Don't start the next until the checkpoint passes.

0

mcp/ Project Setup NEW

Scaffold the standalone MCP server project

\~1h

▼

mcp/ package.json deps: @modelcontextprotocol/sdk, express, typescript tsconfig.json .env.example src/ index.ts entry: createServer() → listen(3001) server.ts buildMcpServer(userId) → McpServer auth.ts validateInternalRequest(headers) → userId | null truemail.ts typed fetch() wrappers for TrueMail REST API tools/ index.ts registerAllTools(server, userId) (one file per tool — added in Phase 2-3)

\# mcp/.env.example TRUEMAIL_API_URL=http://localhost:3000 INTERNAL_API_KEY=\<generate: openssl rand -hex 24> MCP_SHARED_SECRET=\<generate: openssl rand -hex 24> MCP_PORT=3001

**Add to web/.env:** `INTERNAL_API_KEY` (same value as above) and `MCP_SHARED_SECRET` (same value). These two env vars bridge the two processes.

**Checkpoint:** `cd mcp && npm install && npm run dev` starts without errors. Server listens on port 3001.

1

MCP Server + Streamable HTTP NEW

Implement the transport, auth validation, and one stub tool

\~2h

▼

The MCP SDK's `StreamableHTTPServerTransport` is stateless — each POST gets its own transport instance. Wrap it in Express.

// mcp/src/index.ts (key pattern) import express from "express"; import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"; import { validateInternalRequest } from "./auth.js"; import { buildMcpServer } from "./server.js"; const app = express(); app.use(express.json()); app.get("/health", (\_, res) => res.json({ status: "ok" })); app.post("/mcp", async (req, res) => { // auth: X-Internal-Secret + X-User-Id const userId = validateInternalRequest(req.headers); if (!userId) return res.status(401).json({ error: "unauthorized" }); const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, // stateless }); const server = buildMcpServer(userId); await server.connect(transport); await transport.handleRequest(req, res, req.body); await server.close(); });

// mcp/src/auth.ts export function validateInternalRequest(headers: Record\<string, string | string\[\] | undefined>) { const secret = process.env.MCP_SHARED_SECRET; if (headers\["x-internal-secret"\] !== secret) return null; const userId = headers\["x-user-id"\]; return typeof userId === "string" && userId ? userId : null; }

In `server.ts`, register a stub `ping` tool to confirm the transport works before touching real data:

// mcp/src/server.ts (pattern) import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; import { z } from "zod"; export function buildMcpServer(userId: string) { const server = new McpServer({ name: "truemail", version: "1.0.0" }); server.tool("ping", {}, async () => ({ content: \[{ type: "text", text: \`pong — userId: ${userId}\` }\], })); return server; }

**Checkpoint:** Call `POST http://localhost:3001/mcp` with `X-Internal-Secret` + `X-User-Id` headers and a `tools/call` MCP request body for `ping`. It returns a `pong` response.

1.5

TrueMail Internal Auth Middleware MODIFY web/

Let the MCP server call TrueMail API routes without a browser session

\~45m

▼

web/lib/session.ts extend getUserId() to check X-Internal-Key + X-User-Id headers web/.env add INTERNAL_API_KEY=\<same value as mcp/.env>

// web/lib/session.ts — add at the top of getUserId() export async function getUserId(headers: Headers | ReadonlyHeaders): Promise\<string | null> { // Internal service calls (from MCP server) — trust X-Internal-Key const internalKey = headers.get("x-internal-key"); const internalUserId = headers.get("x-user-id"); if (internalKey && internalKey === process.env.INTERNAL_API_KEY && internalUserId) { return internalUserId; } // ... existing session logic unchanged below }

**Why this is safe:** `INTERNAL_API_KEY` never leaves the server. The TrueMail web server only trusts this header for calls that come from the same machine. In production, add an IP allowlist check too.

**Checkpoint:** `curl http://localhost:3000/api/emails?mailboxId=X -H "X-Internal-Key: $KEY" -H "X-User-Id: $UID"` returns real email data (not 401).

2

First Real Tool: search_emails NEW

End-to-end proof: MCP → TrueMail → real inbox data

\~1h

▼

mcp/src/tools/search-emails.ts mcp/src/server.ts import + register

// mcp/src/tools/search-emails.ts import { z } from "zod"; import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; import { truemailGet } from "../truemail.js"; export function registerSearchEmails(server: McpServer, userId: string) { server.tool( "search_emails", { query: z.string().optional().describe("keyword in subject, sender, or body"), folder: z.enum(\["inbox","sent","drafts","all","starred"\]).optional(), limit: z.number().int().min(1).max(20).optional(), }, async ({ query, folder, limit }) => { const params = new URLSearchParams(); if (query) params.set("q", query); if (folder) params.set("folder", folder); if (limit) params.set("limit", String(limit)); // GET /api/emails/search (new lightweight endpoint — see below) const data = await truemailGet(userId, \`/api/emails/search?${params}\`); return { content: \[{ type: "text", text: JSON.stringify(data) }\] }; } ); }

web/app/api/emails/search/route.ts thin wrapper around searchEmailsForUser()

**Why a new /api/emails/search route?** The existing `GET /api/emails` requires a `mailboxId` query param — it lists one mailbox. The MCP tool needs cross-mailbox search. `searchEmailsForUser()` in `lib/emails.ts` already does cross-mailbox search — just expose it at a new URL.

**Checkpoint:** MCP client calls `search_emails` with `query: "Amazon"`. Returns a JSON array of real emails from your TrueMail inbox with `{id, from, subject, snippet, createdAt}`. Only then move to Phase 3.

3

Complete MCP Toolset (6 more tools) NEW

get_email, summarize_email, send_email, reply_email, extract_actions, create_task

\~3h

▼

mcp/src/tools/get-email.ts mcp/src/tools/summarize-email.ts mcp/src/tools/send-email.ts ← requires confirmed:true param mcp/src/tools/reply-email.ts ← requires confirmed:true param mcp/src/tools/extract-actions.ts mcp/src/tools/create-task.ts

Tool-by-tool notes:

- **get_email(id)** — `GET /api/emails/:id`. Return `{id, from, subject, body, date}`. Body is stripped HTML or plain text via `email-text.ts` logic.
- **summarize_email(id)** — `POST /api/ai/summarize {emailId}`. Proxy to existing route, return the summary string.
- **extract_actions(emailId)** — `POST /api/ai/extract-actions {emailId}`. Returns `{actions: string[]}`.
- **create_task(title, dueAt?, priority?)** — `POST /api/tasks {title, dueAt, priority}`. Use existing route. Return the created task.
- **send_email(to, subject, text, mailboxId, confirmed)** — If `confirmed !== true`, return `{pendingConfirmation: true, preview: {...}}` and stop. The UI intercepts this and shows a confirm dialog. Only when `confirmed: true` POSTs to `/api/emails`.
- **reply_email(emailId, text, confirmed)** — Same pattern: return `pendingConfirmation` if not confirmed. When confirmed, `GET /api/emails/:id` to get thread headers, then `POST /api/emails` with the reply. Return sent email.

// Confirmation pattern — same for send_email and reply_email async ({ emailId, text, confirmed }) => { if (!confirmed) { const email = await truemailGet(userId, \`/api/emails/${emailId}\`); return { content: \[{ type: "text", text: JSON.stringify({ pendingConfirmation: true, action: "reply_email", preview: { replyTo: email.from, subject: email.subject, body: text }, }), }\], }; } // confirmed === true: actually send const result = await truemailPost(userId, "/api/emails", { ... }); return { content: \[{ type: "text", text: JSON.stringify(result) }\] }; }

**Checkpoint:** Each of the 7 tools called independently returns structured JSON. Test send_email without `confirmed:true` — verify it returns `pendingConfirmation:true` and does NOT send the email.

4

Agent → MCP Integration NEW MODIFY web/

New /api/agent route: Tomy orchestrator calling tools via MCP instead of direct functions

\~2h

▼

web/app/api/agent/route.ts new route — uses MCP-backed handlers web/lib/ai/mcp-client.ts MCP SDK client + callTool() helper web/lib/ai/mcp-handlers.ts ToolHandlerMap backed by MCP tools web/app/(app)/agent/ (used in Phase 5) web/package.json add @modelcontextprotocol/sdk

// web/lib/ai/mcp-client.ts import { Client } from "@modelcontextprotocol/sdk/client/index.js"; import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"; export async function callMcpTool( userId: string, name: string, args: Record\<string, unknown> ): Promise\<unknown> { const url = new URL(\`${process.env.MCP_SERVER_URL}/mcp\`); const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { "x-internal-secret": process.env.MCP_SHARED_SECRET!, "x-user-id": userId, }, }, }); const client = new Client({ name: "truemail-agent", version: "1.0.0" }); await client.connect(transport); const result = await client.callTool({ name, arguments: args }); await client.close(); // MCP tool results are text content — parse back to JSON const text = (result.content as Array\<{type:string;text:string}>) .find(c => c.type === "text")?.text ?? "null"; return JSON.parse(text); }

// web/lib/ai/mcp-handlers.ts (ToolHandlerMap interface) import { callMcpTool } from "./mcp-client.js"; import type { ToolHandlerMap } from "./orchestrator.js"; export function buildMcpHandlers(timezoneOffsetMinutes: number): ToolHandlerMap { return { search_emails: (uid, args) => callMcpTool(uid, "search_emails", args), get_email: (uid, args) => callMcpTool(uid, "get_email", args), summarize_email: (uid, args) => callMcpTool(uid, "summarize_email", args), send_email: (uid, args) => callMcpTool(uid, "send_email", args), reply_email: (uid, args) => callMcpTool(uid, "reply_email", args), extract_actions: (uid, args) => callMcpTool(uid, "extract_actions", args), create_task: (uid, args) => callMcpTool(uid, "create_task", args), // propose\_\* tools stay as no-ops (agent-side, no MCP needed) propose_task: async () => ({ noted: true }), propose_promise: async () => ({ noted: true }), search_tasks: (uid, args) => callMcpTool(uid, "search_tasks", args), search_promises: (uid, args) => callMcpTool(uid, "search_promises", args), complete_task: (uid, args) => callMcpTool(uid, "complete_task", args), search_calendar: (uid, args) => callMcpTool(uid, "search_calendar", args), }; }

// web/app/api/agent/route.ts — like /api/ai/chat but MCP-backed import { runToolLoop, TOOL_DEFS, buildSystemPrompt } from "@/lib/ai/orchestrator"; import { buildMcpHandlers } from "@/lib/ai/mcp-handlers"; import { chatWithTools } from "@/lib/ai/nvidia"; export async function POST(req: Request) { const userId = await getUserId(req.headers); if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); const body = await req.json(); // same validation as /api/ai/chat... const tz = typeof body.timezoneOffsetMinutes === "number" ? body.timezoneOffsetMinutes : 0; const result = await runAssistant(userId, body.messages, tz, "mcp"); return NextResponse.json(result); }

**Note:** `runAssistant` in `orchestrator.ts` needs a small tweak — accept an optional `mode: "direct" | "mcp"` param. When `"mcp"`, use `buildMcpHandlers(tz)` instead of `buildToolHandlers(tz)`. The existing `/api/ai/chat` keeps using `"direct"` — nothing breaks.

**Checkpoint:** POST `/api/agent` with `"What are my unread emails?"` → agent calls MCP `search_emails` → returns real emails. Watch the MCP server logs show the tool call arriving.

5

Alexa+ Simulation UI NEW

Focused standalone page at /agent — voice-style, tool activity, confirmation dialogs

\~4h

▼

web/app/(app)/agent/page.tsx web/app/(app)/agent/AgentClient.tsx main UI component web/components/agent/AgentInput.tsx input bar + submit web/components/agent/AgentMessage.tsx message bubble (user + assistant) web/components/agent/ToolActivity.tsx "Searching emails…" step indicator web/components/agent/EmailCard.tsx inline email citation card web/components/agent/ActionCard.tsx "Create task" / "Send reply" confirm card web/components/agent/SendConfirmDialog.tsx confirmation for send/reply actions

UI Requirements:

- **Header:** "TrueMail Agent" wordmark + "Powered by MCP" chip. Clean, focused — no sidebar, no inbox chrome.
- **Empty state:** 4 example prompt chips: "What do I need to do today?", "Summarize my latest email", "Reply to Rahul", "Create tasks from my emails".
- **Tool activity:** While agent is running, show animated step list: "Searching emails…" → "Reading email…" → "Extracting actions…" etc. Stream these from the server via SSE or polling, OR derive them client-side by watching for tool-call patterns in the response stream.
- **Citations:** When the API returns `citations[]`, render each as a small card below the agent message — sender, subject, snippet. Clicking opens the email in the inbox.
- **Proposed actions:** When API returns `actions[]` with type `"create_task"`, render an action card with a "Create" button. One click → POST to `/api/agent` with `"Create that task"` message.
- **Confirmation dialogs:** When agent response contains `pendingConfirmation: true`, intercept and show `SendConfirmDialog` with the email preview. Confirm → resend the message with the confirmed flag.
- **Input:** Large textarea, cmd+enter to submit, auto-focus on load.

**Calls /api/agent, not /api/ai/chat.** The new route uses MCP-backed handlers. The existing `/ai` page keeps using `/api/ai/chat` — no changes to existing UI.

**Checkpoint:** Full demo scenario works end-to-end in the browser: "What do I need to do today?" → agent searches, extracts actions, shows proposed tasks → "Reply to Rahul" → confirmation dialog appears → confirm → real email sent. Verify in Rahul's inbox.

6

Open Source + Security + Demo Prep NEW MODIFY

mcp/README, rate limiting, seed data, polish

\~2h

▼

mcp/README.md what it is, quick-start, env vars, tool list, example curl README.md add architecture diagram (Mermaid) + MCP section mcp/src/ratelimit.ts in-memory: max 20 tool calls / minute / userId web/scripts/seed-demo.ts seed 3 demo emails: Amazon, Rahul, Professor

Security checklist:

- MCP server never logs email body — log tool name + userId only
- Rate limit: `Map<userId, {count, resetAt}>` — 429 after 20 req/min
- All 7 tool inputs validated with zod before any API call
- `send_email` / `reply_email` hard-require `confirmed: true`
- MCP server returns 401 on missing/wrong secret, 429 on rate limit — never crashes

\# mcp/README.md quick-start (the open-source story) git clone https://github.com/pandarudra/truemail cd mcp cp .env.example .env # edit .env: point TRUEMAIL_API_URL to your TrueMail instance npm install && npm run build && npm start # MCP server running at http://localhost:3001 # Test: curl -X POST http://localhost:3001/mcp \\ # -H "X-Internal-Secret: $MCP_SHARED_SECRET" \\ # -H "X-User-Id: $YOUR_USER_ID" \\ # -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_emails","arguments":{"query":"Amazon"}},"id":1}'

**Checkpoint:** Demo scenario works with seed data: "What do I need to do today?" identifies 3 action items, agent proposes 3 tasks, user creates them, user replies to Rahul — real email arrives. Screen-record this for the submission video.

## Timeline Summary

All phases in order with estimated duration.

Phase

What you build

Est.

0

mcp/ project scaffolding

1h

1

MCP server + Streamable HTTP transport + ping tool

2h

1.5

TrueMail internal auth middleware (getUserId tweak)

45m

2

search_emails — first real MCP tool end-to-end

1h

3

6 remaining MCP tools (get, summarize, send, reply, extract, create)

3h

4

mcp-client.ts + mcp-handlers.ts + /api/agent route

2h

5

Alexa+ UI at /agent (6 components + confirmation dialogs)

4h

6

README, rate limiting, seed data, demo video

2h

Total

MCP server + agent + Alexa+ UI + open source

\~16h

**Files changed in web/ — what stays untouched:**

All existing routes (`/api/emails`, `/api/ai/*`, `/api/tasks`, `/api/promises`), all existing components (inbox, compose, tasks, etc.), the Prisma schema, all test files, and `/api/ai/chat` (Tomy still works exactly as before). The only modifications to existing files are: `lib/session.ts` (4 lines added), `lib/ai/orchestrator.ts` (optional `mode` param added), `package.json` (one dep added), and `.env` (two env vars added).
