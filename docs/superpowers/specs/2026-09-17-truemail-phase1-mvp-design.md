# TrueMail Phase 1 MVP — Design Spec

Status: Approved by user 2026-09-17. Ready for implementation planning.

## 1. Scope

Phase 1 only (per `docs`/product vision, not reproduced here). Delivers:
auth, BYO-Resend connection, domain connect + DNS verification, mailbox
creation, inbox (list/read/mark/delete), compose/send, inbound webhook.

Explicitly out of scope (deferred to V2 per the product doc, not re-litigated
here): threading, attachments, drafts, starred/archive, search, multiple
Resend connections per user, real-time push, AI features.

## 2. Architecture

Single Next.js (App Router) app, living in the existing `web/` directory.
API routes handle everything server-side — no separate backend service.

- **DB**: PostgreSQL via Supabase, accessed through Prisma.
- **Auth**: Better Auth — email/password + Google OAuth, session cookies.
- **Email transport**: `resend` SDK, instantiated per-request from the
  calling user's *own* decrypted API key. TrueMail's own account, if any,
  is never used to send/receive on a user's behalf.
- **Webhook processing**: synchronous in the API route (verify → write to
  DB → return 200). No queue.
  <!-- ponytail: synchronous webhook handling, add a queue (e.g. pg-boss)
  if inbound volume makes the route slow or Resend's retry budget gets
  exhausted before processing finishes -->

## 3. Data model (Prisma)

```prisma
model User {
  id                String            @id @default(uuid())
  email             String            @unique
  name              String?
  createdAt         DateTime          @default(now())
  resendConnection  ResendConnection?
  domains           Domain[]
  mailboxes         Mailbox[]
  // Better Auth manages its own Session/Account tables alongside this one.
}

model ResendConnection {
  id                     String   @id @default(uuid())
  userId                 String   @unique
  user                   User     @relation(fields: [userId], references: [id])
  encryptedApiKey        String
  webhookId              String
  encryptedWebhookSecret String
  createdAt              DateTime @default(now())
  domains                Domain[]
}

model Domain {
  id             String            @id @default(uuid())
  userId         String
  user           User              @relation(fields: [userId], references: [id])
  connectionId   String
  connection     ResendConnection  @relation(fields: [connectionId], references: [id])
  resendDomainId String
  name           String            @unique
  status         String            // pending | verified | failed
  dnsRecords     Json              // snapshot of records Resend returned
  createdAt      DateTime          @default(now())
  mailboxes      Mailbox[]
}

model Mailbox {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  domainId    String
  domain      Domain   @relation(fields: [domainId], references: [id])
  localPart   String
  address     String   @unique   // localPart@domain.name, denormalized for fast lookup
  displayName String?
  createdAt   DateTime @default(now())
  emails      Email[]
}

model Email {
  id            String    @id @default(uuid())
  mailboxId     String
  mailbox       Mailbox   @relation(fields: [mailboxId], references: [id])
  resendEmailId String?   // Resend's id; null until an outbound send resolves
  direction     String    // "in" | "out"
  from          String
  to            String[]
  cc            String[]
  subject       String
  text          String?
  html          String?
  status        String    // sent | delivered | bounced | received | failed
  read          Boolean   @default(false)
  starred       Boolean   @default(false)
  sentAt        DateTime?
  receivedAt    DateTime?
  createdAt     DateTime  @default(now())
}
```

No `Attachment` or `Thread` tables — both are V2 features with no UI to back
them in Phase 1.

## 4. Flows

### 4.1 Connect Resend
1. User pastes API key.
2. Server validates it by calling `resend.domains.list()` with that key —
   a 401 means invalid, surfaced back to the user.
3. Encrypt the key (AES-256-GCM via Node's built-in `crypto`; key from
   `ENCRYPTION_KEY` env var — no new dependency).
4. Create a webhook via `resend.webhooks.create({ endpoint, events })` where
   `endpoint` is `https://<app-host>/api/webhooks/resend/<connectionId>`
   (connection row is created first to get the id) and `events` includes
   `email.received`, `email.sent`, `email.delivered`, `email.bounced`.
5. Store `webhookId` and the encrypted `signing_secret` on the connection.

This resolves the multi-tenant webhook problem: because each connection has
its own webhook at its own URL, the inbound route reads `connectionId`
straight from the path — no guessing which of N stored secrets to try.

### 4.2 Connect domain
1. `resend.domains.create({ name })` using the connection's decrypted key.
2. Store the `Domain` row (`status: pending`, `dnsRecords` = `data.records`).
3. Show DNS records grouped by type, each with a copy button.
4. "Verify" button: `resend.domains.verify(id)`, then `resend.domains.get(id)`
   to refresh `status` (`pending` | `verified` | `failed`).

### 4.3 Create mailbox
Pure DB write — no Resend API call. Resend already routes any recipient at
a receiving-enabled domain to the connection's webhook; the `Mailbox` row is
what makes an address "ours" for inbox filtering and a valid `from` for
sending. Requires the parent `Domain.status === 'verified'`.

### 4.4 Send
1. Validate the `from` mailbox belongs to the caller and its domain is
   verified.
2. Generate a UUID (`sendId`) before calling Resend — it becomes both the
   idempotency key (`"send/" + sendId`) and, on success, the `Email.id`.
   This makes a client-side retry of the same request idempotent on both
   sides: Resend dedupes by key, and re-inserting the same `Email.id` is a
   no-op conflict rather than a duplicate row.
3. `resend.emails.send({...}, { idempotencyKey: "send/" + sendId })`.
4. Insert the `Email` row (`id: sendId`, `direction: out`, `status: sent`,
   `resendEmailId: data.id`).

### 4.5 Receive (webhook)
`POST /api/webhooks/resend/[connectionId]`:
1. Read raw body (`req.text()`, never `req.json()` — required for
   signature verification).
2. Look up the connection by `connectionId`, decrypt its webhook secret.
3. `resend.webhooks.verify({ payload, headers, secret })`. Invalid
   signature → `400`, done.
4. Route by `event.type`:
   - `email.received`: fetch full body via
     `resend.emails.receiving.get(event.data.email_id)`, match a recipient
     in `to` against `Mailbox.address`, insert `Email` row
     (`direction: in`, `status: received`).
   - `email.sent` / `email.delivered` / `email.bounced`: find the `Email`
     row by `resendEmailId === event.data.email_id`, update `status`.
5. Always return `200` quickly (Resend retries with backoff on non-200).

## 5. API routes

```
app/api/auth/[...all]/route.ts           Better Auth handler
app/api/resend-connection/route.ts       POST connect, GET status
app/api/domains/route.ts                 POST create, GET list
app/api/domains/[id]/verify/route.ts     POST trigger + refresh verification
app/api/mailboxes/route.ts               POST create, GET list
app/api/emails/route.ts                  GET list (inbox/sent via query), POST send
app/api/emails/[id]/route.ts             GET one, PATCH read/starred, DELETE
app/api/webhooks/resend/[connectionId]/route.ts   POST inbound + status events
```

Every handler (except the webhook, which authenticates via signature
instead of a session) scopes its Prisma queries to `session.userId`.

## 6. UI

Plain three-pane mail client: sidebar (mailbox switcher, Inbox/Sent, Compose
button) → message list (sender, subject, snippet, timestamp, unread dot) →
reading pane. Compose is its own panel/route, not a modal stack.

Onboarding (connect Resend → connect domain → DNS → create mailbox) is a
centered single-column step flow; DNS record values render in a monospace
block with a copy button.

Visual language: one distinctive typeface (Geist, not Inter), near-monochrome
palette (near-black text on off-white background) with a single accent color
used sparingly for primary actions/unread state, generous whitespace, no
gradients or heavy shadows. Motion limited to functional 150–200ms
hover/select/panel-open transitions — no scroll-driven animation, no bento
grids. (The product doc's marketing landing page, §28, is a separate later
piece of work and is where a heavier, cinematic treatment belongs — not
here.)

## 7. Security

- `ENCRYPTION_KEY` (32 bytes) encrypts Resend API keys and webhook signing
  secrets at rest; plaintext never touches the browser.
- Webhook signature verification is mandatory before any DB write in the
  inbound route.
- Every non-webhook API route scopes all queries to the authenticated
  session's `userId` — no cross-user reads.

## 8. Testing

- Encryption round-trip: one `assert`-based self-check
  (`encrypt(x) → decrypt → equals x`, and tampered ciphertext fails).
- Webhook verification: one test posting a signed payload (using
  `resend.webhooks` test helpers or a hand-rolled svix signature) and
  asserting an unsigned/mis-signed payload is rejected with 400.
- Manual end-to-end pass through the golden path using
  `delivered@resend.dev` (never a real inbox) for send, and Resend's
  dashboard "Send test email" for receive, before calling Phase 1 done.
