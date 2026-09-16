# TrueMail Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working Phase 1 TrueMail: auth, BYO-Resend connection, domain
connect + DNS verification, mailbox creation, compose/send, inbound webhook,
and a plain three-pane inbox UI.

**Architecture:** Single Next.js (App Router) app in `web/`. API routes handle
Prisma/Postgres reads-writes and call the Resend SDK using each user's own
decrypted API key. Better Auth handles sessions. Each Resend connection gets
its own webhook at a URL that encodes the connection id, so the inbound route
never has to guess which of many stored secrets to verify against.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma + PostgreSQL
(Supabase), Better Auth, `resend` SDK, Vitest, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-09-17-truemail-phase1-mvp-design.md`

## Global Constraints

- API keys and webhook signing secrets are encrypted at rest (AES-256-GCM via
  Node's built-in `crypto`, key from `ENCRYPTION_KEY`) and never sent to the
  browser.
- Every non-webhook API route scopes all Prisma queries to the authenticated
  session's `userId` — no cross-user reads.
- The inbound webhook route verifies the Resend signature before any DB
  write.
- No `Attachment` or `Thread` models/UI — out of scope for Phase 1.
- UI: one distinctive typeface (Geist — already configured in
  `app/layout.tsx`, do not switch to Inter), near-monochrome palette with a
  single accent color used sparingly, no gradients or heavy shadows, motion
  limited to functional 150–200ms hover/select/panel-open transitions only.
- Working directory for every command below is `web/` unless stated
  otherwise.

---

## Task 1: Project setup — dependencies, env, Prisma schema, DB client

**Files:**
- Modify: `web/package.json`
- Create: `web/.env.example`
- Modify: `web/.gitignore`
- Create: `web/prisma/schema.prisma`
- Create: `web/lib/db.ts`
- Create: `web/vitest.config.ts`
- Create: `web/vitest.setup.ts`

**Interfaces:**
- Produces: `prisma` (PrismaClient singleton) exported from
  `web/lib/db.ts`, imported everywhere else as `import { prisma } from
  "@/lib/db"`.
- Produces: Prisma models `User`, `ResendConnection`, `Domain`, `Mailbox`,
  `Email` (exact fields below) available to every later task.

- [ ] **Step 1: Install dependencies**

```bash
npm install @prisma/client resend better-auth
npm install -D prisma vitest
```

- [ ] **Step 2: Add env template and ignore local env files**

`web/.env.example`:
```bash
DATABASE_URL="postgresql://user:password@host:5432/truemail?sslmode=require"
# 32 random bytes, base64-encoded. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=""
BETTER_AUTH_SECRET=""
APP_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

Confirm `.env*` is already ignored (it is — see `web/.gitignore`'s
`# env files` block). No change needed there; this sub-step is just a
verification, not an edit.

- [ ] **Step 3: Initialize Prisma and write the schema**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `web/prisma/schema.prisma` with a default `datasource`/
`generator` block and a `web/.env` with a placeholder `DATABASE_URL`. Replace
the whole file with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  name          String?
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  resendConnection ResendConnection?
  domains          Domain[]
  mailboxes        Mailbox[]
}

model ResendConnection {
  id                     String   @id @default(uuid())
  userId                 String   @unique
  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  encryptedApiKey        String
  webhookId              String
  encryptedWebhookSecret String
  createdAt              DateTime @default(now())
  domains                Domain[]
}

model Domain {
  id             String           @id @default(uuid())
  userId         String
  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  connectionId   String
  connection     ResendConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  resendDomainId String
  name           String           @unique
  status         String           @default("pending")
  dnsRecords     Json
  createdAt      DateTime         @default(now())
  mailboxes      Mailbox[]
}

model Mailbox {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  domainId    String
  domain      Domain   @relation(fields: [domainId], references: [id], onDelete: Cascade)
  localPart   String
  address     String   @unique
  displayName String?
  createdAt   DateTime @default(now())
  emails      Email[]
}

model Email {
  id            String    @id @default(uuid())
  mailboxId     String
  mailbox       Mailbox   @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  resendEmailId String?
  direction     String
  from          String
  to            String[]
  cc            String[]
  subject       String
  text          String?
  html          String?
  status        String
  read          Boolean   @default(false)
  starred       Boolean   @default(false)
  sentAt        DateTime?
  receivedAt    DateTime?
  createdAt     DateTime  @default(now())
}
```

`User.emailVerified`/`image`/`updatedAt` are here because Task 3 (Better
Auth) requires them on the core user model — adding them now avoids a
schema churn later.

- [ ] **Step 4: Point `DATABASE_URL` at your Supabase Postgres instance**

Copy `.env.example` to `.env` and fill in `DATABASE_URL` from your Supabase
project's connection string (Project Settings → Database → Connection
string → URI, "Transaction" pooler mode). Leave the other vars blank for
now — they're filled in by later tasks.

```bash
cp .env.example .env
```

- [ ] **Step 5: Run the initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: migration applies cleanly and `npx prisma validate` reports the
schema is valid.

- [ ] **Step 6: Prisma client singleton**

`web/lib/db.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 7: Vitest config**

`web/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

`web/vitest.setup.ts`:
```typescript
import { randomBytes } from "crypto";

process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
```

Add a `test` script to `web/package.json`'s `scripts` block:
```json
"test": "vitest run"
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: set up Prisma schema, DB client, and Vitest"
```

---

## Task 2: Encryption helper

**Files:**
- Create: `web/lib/crypto.ts`
- Test: `web/lib/crypto.test.ts`

**Interfaces:**
- Consumes: `process.env.ENCRYPTION_KEY` (set in Task 1's env template; set
  automatically for tests by `vitest.setup.ts`).
- Produces: `encrypt(plaintext: string): string` and
  `decrypt(ciphertext: string): string`, imported elsewhere as
  `import { encrypt, decrypt } from "@/lib/crypto"`.

- [ ] **Step 1: Write the failing tests**

`web/lib/crypto.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

describe("crypto", () => {
  it("round-trips plaintext", () => {
    const secret = "re_1234567890abcdef";
    const ciphertext = encrypt(secret);
    expect(ciphertext).not.toBe(secret);
    expect(decrypt(ciphertext)).toBe(secret);
  });

  it("rejects tampered ciphertext", () => {
    const ciphertext = encrypt("re_1234567890abcdef");
    const [iv, authTag, data] = ciphertext.split(".");
    const tamperedBytes = Buffer.from(data, "base64");
    tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
    const tampered = [iv, authTag, tamperedBytes.toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/crypto.test.ts`
Expected: FAIL — `./crypto` has no exports yet (module not found).

- [ ] **Step 3: Implement**

`web/lib/crypto.ts`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext]
    .map((buf) => buf.toString("base64"))
    .join(".");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed ciphertext");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/crypto.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/crypto.ts lib/crypto.test.ts
git commit -m "feat: add AES-256-GCM encryption helper for secrets at rest"
```

---

## Task 3: Better Auth setup

**Files:**
- Create: `web/lib/auth.ts`
- Modify: `web/prisma/schema.prisma` (Better Auth CLI appends `Session`,
  `Account`, `Verification` models)
- Create: `web/app/api/auth/[...all]/route.ts`
- Create: `web/lib/auth-client.ts`
- Create: `web/lib/session.ts`

**Interfaces:**
- Produces: `auth` (Better Auth server instance) from `@/lib/auth`.
- Produces: `authClient` (Better Auth React client) from `@/lib/auth-client`,
  used by Task 4's login/signup pages.
- Produces: `getUserId(headers: Headers): Promise<string | null>` from
  `@/lib/session`, used by every API route in Tasks 6–10 to authenticate.

- [ ] **Step 1: Write the Better Auth server config**

`web/lib/auth.ts`:
```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.APP_URL,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
});
```

- [ ] **Step 2: Generate the auth tables and merge them into the schema**

```bash
npx @better-auth/cli generate --config lib/auth.ts -y
```

This appends `Session`, `Account`, and `Verification` models to
`prisma/schema.prisma` and may adjust the `User` model. Open the file
afterward and confirm `User` still has the app relations from Task 1
(`resendConnection`, `domains`, `mailboxes`) — if the generator rewrote the
`User` block without them, add those three relation lines back in.

- [ ] **Step 3: Migrate**

```bash
npx prisma migrate dev --name better_auth
```

Expected: migration applies cleanly.

- [ ] **Step 4: Route handler**

`web/app/api/auth/[...all]/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 5: Client instance**

`web/lib/auth-client.ts`:
```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
```

Add `NEXT_PUBLIC_APP_URL="http://localhost:3000"` to `web/.env.example` and
your local `web/.env` (the client needs a `NEXT_PUBLIC_`-prefixed var since
`APP_URL` alone isn't exposed to the browser).

- [ ] **Step 6: Session helper for API routes**

`web/lib/session.ts`:
```typescript
import { auth } from "@/lib/auth";

export async function getUserId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
```

- [ ] **Step 7: Manual check**

Run: `npm run dev`, then in another terminal:
```bash
curl -i http://localhost:3000/api/auth/session
```
Expected: `200` with `null` or an empty session body (no error) — confirms
the route handler is wired up before any UI exists.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Better Auth (email/password + Google) with session helper"
```

---

## Task 4: Login / signup UI

**Files:**
- Create: `web/app/login/page.tsx`
- Create: `web/app/signup/page.tsx`

**Interfaces:**
- Consumes: `authClient` from `@/lib/auth-client` (Task 3).

- [ ] **Step 1: Signup page**

`web/app/signup/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signupError } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    setLoading(false);
    if (signupError) {
      setError(signupError.message ?? "Sign up failed");
      return;
    }
    router.push("/onboarding/resend");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-2xl font-semibold text-foreground">
          Create your TrueMail account
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => authClient.signIn.social({ provider: "google" })}
          className="mt-4 w-full rounded-md border border-black/10 px-4 py-2 font-medium transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
        >
          Continue with Google
        </button>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-indigo-600">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Login page**

`web/app/login/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: loginError } = await authClient.signIn.email({
      email,
      password,
    });
    setLoading(false);
    if (loginError) {
      setError(loginError.message ?? "Login failed");
      return;
    }
    router.push("/inbox");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-2xl font-semibold text-foreground">
          Log in to TrueMail
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => authClient.signIn.social({ provider: "google" })}
          className="mt-4 w-full rounded-md border border-black/10 px-4 py-2 font-medium transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
        >
          Continue with Google
        </button>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          No account?{" "}
          <a href="/signup" className="font-medium text-indigo-600">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Manual check**

Run `npm run dev`, visit `/signup`, create an account with email+password.
Expected: redirected to `/onboarding/resend` (route doesn't exist until
Task 6 — a 404 here is fine and expected for now; it confirms signup
succeeded and the redirect fired).

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx app/signup/page.tsx
git commit -m "feat: add login and signup pages"
```

---

## Task 5: Dashboard shell and onboarding gate

**Files:**
- Create: `web/app/(app)/layout.tsx`
- Modify: `web/app/page.tsx`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth` (Task 3).
- Produces: the `(app)` route group — every page created in Tasks 6–12
  lives under it and inherits its auth guard.

- [ ] **Step 1: Root page redirects based on session**

`web/app/page.tsx` (replace the existing default content entirely):
```typescript
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  redirect(session ? "/inbox" : "/login");
}
```

- [ ] **Step 2: Auth-gated layout with onboarding routing**

`web/app/(app)/layout.tsx`:
```typescript
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
```

Note: this layout only guards auth — it does **not** redirect into
onboarding itself. The onboarding pages (Tasks 6–8) are a linear wizard:
each one's own submit handler pushes to the next step, and the inbox page
(Task 11) pushes back to `/onboarding/mailbox` if the user has no mailbox
yet. Nothing checks "is this step already done" on page load — revisiting
a completed step (e.g. browser back button to `/onboarding/resend` after
already connecting) just lets the user redo it harmlessly, rather than
auto-skipping forward. A shared prerequisite/redirect table is the upgrade
path if that becomes annoying enough to matter.
<!-- ponytail: onboarding steps don't auto-skip when already complete,
upgrade to a shared prerequisite/redirect table if that gets annoying -->

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx "app/(app)/layout.tsx"
git commit -m "feat: add session-gated app layout and root redirect"
```

---

## Task 6: Resend connection

**Files:**
- Create: `web/lib/resend-client.ts`
- Create: `web/app/api/resend-connection/route.ts`
- Create: `web/app/(app)/onboarding/resend/page.tsx`

**Interfaces:**
- Consumes: `getUserId` (Task 3), `prisma` (Task 1), `encrypt`/`decrypt`
  (Task 2).
- Produces: `getConnectionForUser(userId: string): Promise<{ connection:
  ResendConnection; resend: Resend } | null>` and `getConnectionById(id:
  string): Promise<{ connection: ResendConnection; resend: Resend;
  webhookSecret: string } | null>` from `@/lib/resend-client`, used by
  Tasks 7, 9, and 10.

- [ ] **Step 1: Resend client helper**

`web/lib/resend-client.ts`:
```typescript
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function getConnectionForUser(userId: string) {
  const connection = await prisma.resendConnection.findUnique({
    where: { userId },
  });
  if (!connection) return null;
  const apiKey = decrypt(connection.encryptedApiKey);
  return { connection, resend: new Resend(apiKey) };
}

export async function getConnectionById(connectionId: string) {
  const connection = await prisma.resendConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) return null;
  const apiKey = decrypt(connection.encryptedApiKey);
  const webhookSecret = decrypt(connection.encryptedWebhookSecret);
  return { connection, resend: new Resend(apiKey), webhookSecret };
}
```

- [ ] **Step 2: Connection API route**

`web/app/api/resend-connection/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const connection = await prisma.resendConnection.findUnique({
    where: { userId },
    select: { id: true, createdAt: true },
  });
  return NextResponse.json({ connected: !!connection, connection });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const apiKey: string | undefined = body?.apiKey;
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const resend = new Resend(apiKey);
  const { error: validateError } = await resend.domains.list();
  if (validateError) {
    return NextResponse.json(
      { error: "Invalid Resend API key" },
      { status: 400 }
    );
  }

  const connection = await prisma.resendConnection.create({
    data: {
      userId,
      encryptedApiKey: encrypt(apiKey),
      webhookId: "",
      encryptedWebhookSecret: "",
    },
  });

  const endpoint = `${process.env.APP_URL}/api/webhooks/resend/${connection.id}`;
  const { data: webhook, error: webhookError } = await resend.webhooks.create({
    endpoint,
    events: ["email.received", "email.sent", "email.delivered", "email.bounced"],
  });

  if (webhookError || !webhook) {
    await prisma.resendConnection.delete({ where: { id: connection.id } });
    return NextResponse.json(
      { error: "Failed to register webhook with Resend" },
      { status: 502 }
    );
  }

  await prisma.resendConnection.update({
    where: { id: connection.id },
    data: {
      webhookId: webhook.id,
      encryptedWebhookSecret: encrypt(webhook.signing_secret),
    },
  });

  return NextResponse.json({ connected: true, id: connection.id });
}
```

- [ ] **Step 3: Onboarding UI**

`web/app/(app)/onboarding/resend/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConnectResendPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/resend-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Something went wrong");
      return;
    }
    router.push("/onboarding/domain");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Connect your Resend account
        </h1>
        <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
          TrueMail sends and receives email through your own Resend account.
          Paste an API key from{" "}
          <a
            href="https://resend.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600"
          >
            resend.com/api-keys
          </a>
          .
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="re_xxxxxxxxxxxxxxxxxxxxx"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 font-mono text-sm dark:border-white/15"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Manual check**

With a real Resend API key: sign up, land on `/onboarding/resend`, paste
the key, submit. Expected: redirected to `/onboarding/domain` (404 until
Task 7 — expected), and in the Resend dashboard under Webhooks, a new
webhook exists pointed at `<APP_URL>/api/webhooks/resend/<connectionId>`.

- [ ] **Step 5: Commit**

```bash
git add lib/resend-client.ts app/api/resend-connection/route.ts "app/(app)/onboarding/resend/page.tsx"
git commit -m "feat: add Resend connection flow"
```

---

## Task 7: Domain connect + DNS verification

**Files:**
- Create: `web/app/api/domains/route.ts`
- Create: `web/app/api/domains/[id]/verify/route.ts`
- Create: `web/app/(app)/onboarding/domain/page.tsx`
- Create: `web/components/DnsRecordCard.tsx`

**Interfaces:**
- Consumes: `getUserId` (Task 3), `getConnectionForUser` (Task 6), `prisma`
  (Task 1).
- Produces: nothing new consumed by later tasks beyond the `Domain` rows
  themselves (already defined in Task 1's schema).

- [ ] **Step 1: Create + list domains**

`web/app/api/domains/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const domains = await prisma.domain.findMany({ where: { userId } });
  return NextResponse.json({ domains });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name: string | undefined = body?.name;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const connectionResult = await getConnectionForUser(userId);
  if (!connectionResult) {
    return NextResponse.json(
      { error: "Connect a Resend account first" },
      { status: 400 }
    );
  }
  const { connection, resend } = connectionResult;

  const { data, error } = await resend.domains.create({ name });
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create domain in Resend" },
      { status: 502 }
    );
  }

  await resend.domains.update({
    id: data.id,
    capabilities: { sending: "enabled", receiving: "enabled" },
  });

  const domain = await prisma.domain.create({
    data: {
      userId,
      connectionId: connection.id,
      resendDomainId: data.id,
      name,
      status: "pending",
      dnsRecords: data.records,
    },
  });

  return NextResponse.json({ domain });
}
```

- [ ] **Step 2: Verify endpoint**

`web/app/api/domains/[id]/verify/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const domain = await prisma.domain.findFirst({ where: { id, userId } });
  if (!domain) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const connectionResult = await getConnectionForUser(userId);
  if (!connectionResult) {
    return NextResponse.json({ error: "no Resend connection" }, { status: 400 });
  }
  const { resend } = connectionResult;

  await resend.domains.verify(domain.resendDomainId);
  const { data, error } = await resend.domains.get(domain.resendDomainId);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to refresh domain status" },
      { status: 502 }
    );
  }

  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: { status: data.status },
  });

  return NextResponse.json({ domain: updated });
}
```

- [ ] **Step 3: DNS record card component**

`web/components/DnsRecordCard.tsx`:
```typescript
"use client";

import { useState } from "react";

type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  priority?: number;
};

export function DnsRecordCard({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(record.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {record.record} · {record.type}
      </p>
      <p className="mb-1 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
        {record.name}
      </p>
      <div className="flex items-center gap-2">
        <p className="flex-1 break-all font-mono text-xs">{record.value}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-black/10 px-2 py-1 text-xs font-medium transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Onboarding UI**

`web/app/(app)/onboarding/domain/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DnsRecordCard } from "@/components/DnsRecordCard";

type Domain = {
  id: string;
  name: string;
  status: string;
  dnsRecords: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
  }>;
};

export default function ConnectDomainPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState<Domain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Something went wrong");
      return;
    }
    const { domain: created } = await res.json();
    setDomain(created);
  }

  async function handleVerify() {
    if (!domain) return;
    setLoading(true);
    const res = await fetch(`/api/domains/${domain.id}/verify`, {
      method: "POST",
    });
    setLoading(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Verification failed");
      return;
    }
    const { domain: updated } = await res.json();
    setDomain(updated);
    if (updated.status === "verified") {
      router.push("/onboarding/mailbox");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Connect your domain
        </h1>
        {!domain && (
          <>
            <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
              Use a subdomain (e.g. <code>mail.yourdomain.com</code>) to avoid
              conflicts with any email you already have on the root domain.
            </p>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="mail.yourdomain.com"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Continue"}
              </button>
            </form>
          </>
        )}
        {domain && (
          <>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Add these records at your DNS provider, then verify.
            </p>
            <div className="mb-6 flex flex-col gap-3">
              {domain.dnsRecords.map((record, i) => (
                <DnsRecordCard key={i} record={record} />
              ))}
            </div>
            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading
                ? "Checking..."
                : domain.status === "verified"
                  ? "Verified — continue"
                  : "Verify domain"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Manual check**

Create a domain with a real subdomain you control, add the returned DNS
records, click Verify. Expected: status flips to `verified` once DNS has
propagated (can take minutes — re-click Verify to re-poll), then redirect
to `/onboarding/mailbox` (404 until Task 8 — expected).

- [ ] **Step 6: Commit**

```bash
git add app/api/domains components/DnsRecordCard.tsx "app/(app)/onboarding/domain/page.tsx"
git commit -m "feat: add domain connect and DNS verification flow"
```

---

## Task 8: Mailbox creation

**Files:**
- Create: `web/app/api/mailboxes/route.ts`
- Create: `web/app/(app)/onboarding/mailbox/page.tsx`

**Interfaces:**
- Consumes: `getUserId` (Task 3), `prisma` (Task 1).
- Produces: `Mailbox` rows consumed by Tasks 9–12.

- [ ] **Step 1: Mailbox API route**

`web/app/api/mailboxes/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const mailboxes = await prisma.mailbox.findMany({ where: { userId } });
  return NextResponse.json({ mailboxes });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const domainId: string | undefined = body?.domainId;
  const localPart: string | undefined = body?.localPart;
  const displayName: string | undefined = body?.displayName;

  if (!domainId || !localPart) {
    return NextResponse.json(
      { error: "domainId and localPart are required" },
      { status: 400 }
    );
  }

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, userId },
  });
  if (!domain) {
    return NextResponse.json({ error: "domain not found" }, { status: 404 });
  }
  if (domain.status !== "verified") {
    return NextResponse.json(
      { error: "domain is not verified yet" },
      { status: 400 }
    );
  }

  const address = `${localPart}@${domain.name}`;
  const mailbox = await prisma.mailbox.create({
    data: { userId, domainId, localPart, address, displayName },
  });

  return NextResponse.json({ mailbox });
}
```

- [ ] **Step 2: Onboarding UI**

`web/app/(app)/onboarding/mailbox/page.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Domain = { id: string; name: string; status: string };

export default function CreateMailboxPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainId, setDomainId] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/domains")
      .then((res) => res.json())
      .then(({ domains: all }: { domains: Domain[] }) => {
        const verified = all.filter((d) => d.status === "verified");
        setDomains(verified);
        if (verified[0]) setDomainId(verified[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId, localPart }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Something went wrong");
      return;
    }
    router.push("/inbox");
  }

  const selectedDomain = domains.find((d) => d.id === domainId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-2xl font-semibold text-foreground">
          Create your first mailbox
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="hello"
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
              required
              className="flex-1 rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
            />
            <span className="text-zinc-500">@</span>
            <select
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {localPart && selectedDomain && (
            <p className="text-sm text-zinc-500">
              This creates{" "}
              <span className="font-mono">
                {localPart}@{selectedDomain.name}
              </span>
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !domainId}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create mailbox"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Manual check**

With a verified domain from Task 7, create a mailbox with local part
`hello`. Expected: redirected to `/inbox` (404 until Task 11 — expected),
and `Mailbox.address` in the DB reads `hello@<your-domain>`.

- [ ] **Step 4: Commit**

```bash
git add app/api/mailboxes "app/(app)/onboarding/mailbox/page.tsx"
git commit -m "feat: add mailbox creation flow"
```

---

## Task 9: Inbound webhook

**Files:**
- Create: `web/lib/webhook.ts`
- Test: `web/lib/webhook.test.ts`
- Create: `web/app/api/webhooks/resend/[connectionId]/route.ts`

**Interfaces:**
- Consumes: `getConnectionById` (Task 6), `prisma` (Task 1).
- Produces: `verifyWebhookEvent(resend: Resend, payload: string, headers:
  {"svix-id": string | null; "svix-timestamp": string | null;
  "svix-signature": string | null}, secret: string)` from `@/lib/webhook`.

- [ ] **Step 1: Write the failing test**

`web/lib/webhook.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { Resend } from "resend";
import { verifyWebhookEvent } from "./webhook";

describe("verifyWebhookEvent", () => {
  it("rejects a payload with a mismatched signature", () => {
    const resend = new Resend("re_test_placeholder");
    const payload = JSON.stringify({ type: "email.received", data: {} });

    expect(() =>
      verifyWebhookEvent(
        resend,
        payload,
        {
          "svix-id": "msg_test",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "v1,thisisnotavalidsignature==",
        },
        "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"
      )
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/webhook.test.ts`
Expected: FAIL — `./webhook` has no exports yet.

- [ ] **Step 3: Implement**

`web/lib/webhook.ts`:
```typescript
import type { Resend } from "resend";

type SvixHeaders = {
  "svix-id": string | null;
  "svix-timestamp": string | null;
  "svix-signature": string | null;
};

export function verifyWebhookEvent(
  resend: Resend,
  payload: string,
  headers: SvixHeaders,
  secret: string
) {
  return resend.webhooks.verify({ payload, headers, secret });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/webhook.test.ts`
Expected: PASS

- [ ] **Step 5: Webhook route**

`web/app/api/webhooks/resend/[connectionId]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConnectionById } from "@/lib/resend-client";
import { verifyWebhookEvent } from "@/lib/webhook";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const connectionResult = await getConnectionById(connectionId);
  if (!connectionResult) {
    return NextResponse.json({ error: "unknown connection" }, { status: 404 });
  }
  const { resend, webhookSecret } = connectionResult;

  const payload = await req.text();
  let event;
  try {
    event = verifyWebhookEvent(
      resend,
      payload,
      {
        "svix-id": req.headers.get("svix-id"),
        "svix-timestamp": req.headers.get("svix-timestamp"),
        "svix-signature": req.headers.get("svix-signature"),
      },
      webhookSecret
    );
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "email.received") {
    const { data: email } = await resend.emails.receiving.get(
      event.data.email_id
    );
    if (email) {
      const recipient = email.to.find(Boolean);
      const mailbox = recipient
        ? await prisma.mailbox.findUnique({ where: { address: recipient } })
        : null;
      if (mailbox) {
        await prisma.email.create({
          data: {
            mailboxId: mailbox.id,
            resendEmailId: event.data.email_id,
            direction: "in",
            from: email.from,
            to: email.to,
            cc: email.cc ?? [],
            subject: email.subject ?? "",
            text: email.text,
            html: email.html,
            status: "received",
            receivedAt: new Date(),
          },
        });
      }
    }
  } else if (
    event.type === "email.sent" ||
    event.type === "email.delivered" ||
    event.type === "email.bounced"
  ) {
    const status = event.type.replace("email.", "");
    await prisma.email.updateMany({
      where: { resendEmailId: event.data.email_id },
      data: { status },
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/webhook.ts lib/webhook.test.ts app/api/webhooks
git commit -m "feat: add inbound Resend webhook with signature verification"
```

---

## Task 10: Emails API (list, get, send, update, delete)

**Files:**
- Create: `web/app/api/emails/route.ts`
- Create: `web/app/api/emails/[id]/route.ts`

**Interfaces:**
- Consumes: `getUserId` (Task 3), `prisma` (Task 1), `getConnectionForUser`
  (Task 6).
- Produces: nothing new consumed by later tasks beyond the HTTP contract
  used by Tasks 11–12.

- [ ] **Step 1: List + send**

`web/app/api/emails/route.ts`:
```typescript
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mailboxId = url.searchParams.get("mailboxId");
  const direction = url.searchParams.get("direction");
  if (!mailboxId) {
    return NextResponse.json({ error: "mailboxId is required" }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, userId },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const emails = await prisma.email.findMany({
    where: {
      mailboxId,
      ...(direction ? { direction } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ emails });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const mailboxId: string | undefined = body?.mailboxId;
  const to: string[] | undefined = body?.to;
  const subject: string | undefined = body?.subject;
  const text: string | undefined = body?.text;
  const html: string | undefined = body?.html;
  const cc: string[] = body?.cc ?? [];

  if (!mailboxId || !to?.length || !subject) {
    return NextResponse.json(
      { error: "mailboxId, to, and subject are required" },
      { status: 400 }
    );
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, userId },
    include: { domain: true },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (mailbox.domain.status !== "verified") {
    return NextResponse.json(
      { error: "domain is not verified" },
      { status: 400 }
    );
  }

  const connectionResult = await getConnectionForUser(userId);
  if (!connectionResult) {
    return NextResponse.json({ error: "no Resend connection" }, { status: 400 });
  }
  const { resend } = connectionResult;

  const sendId = randomUUID();
  const { data, error } = await resend.emails.send(
    {
      from: mailbox.address,
      to,
      cc,
      subject,
      text,
      html,
    },
    { idempotencyKey: `send/${sendId}` }
  );

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to send email" },
      { status: 502 }
    );
  }

  const email = await prisma.email.create({
    data: {
      id: sendId,
      mailboxId,
      resendEmailId: data.id,
      direction: "out",
      from: mailbox.address,
      to,
      cc,
      subject,
      text,
      html,
      status: "sent",
      sentAt: new Date(),
    },
  });

  return NextResponse.json({ email });
}
```

- [ ] **Step 2: Get, update, delete a single email**

`web/app/api/emails/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

async function loadOwnedEmail(id: string, userId: string) {
  return prisma.email.findFirst({
    where: { id, mailbox: { userId } },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const email = await loadOwnedEmail(id, userId);
  if (!email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ email });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedEmail(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: { read?: boolean; starred?: boolean } = {};
  if (typeof body?.read === "boolean") data.read = body.read;
  if (typeof body?.starred === "boolean") data.starred = body.starred;

  const email = await prisma.email.update({ where: { id }, data });
  return NextResponse.json({ email });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedEmail(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.email.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/emails
git commit -m "feat: add emails API — list, send, get, update, delete"
```

---

## Task 11: Inbox UI

**Files:**
- Create: `web/app/(app)/inbox/page.tsx`
- Create: `web/components/Sidebar.tsx`
- Create: `web/components/MessageList.tsx`
- Create: `web/components/ReadingPane.tsx`

**Interfaces:**
- Consumes: `/api/mailboxes` and `/api/emails*` routes (Tasks 8, 10).

- [ ] **Step 1: Sidebar**

`web/components/Sidebar.tsx`:
```typescript
"use client";

type Mailbox = { id: string; address: string };

export function Sidebar({
  mailboxes,
  activeMailboxId,
  onSelectMailbox,
}: {
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  onSelectMailbox: (id: string) => void;
}) {
  return (
    <aside className="flex w-56 flex-col border-r border-black/10 p-4 dark:border-white/15">
      <a
        href="/compose"
        className="mb-6 rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        Compose
      </a>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Mailboxes
      </p>
      <nav className="flex flex-col gap-1">
        {mailboxes.map((mailbox) => (
          <button
            key={mailbox.id}
            type="button"
            onClick={() => onSelectMailbox(mailbox.id)}
            className={`truncate rounded-md px-3 py-2 text-left text-sm transition-colors ${
              mailbox.id === activeMailboxId
                ? "bg-black/[.06] font-medium dark:bg-white/[.08]"
                : "hover:bg-black/[.03] dark:hover:bg-white/[.05]"
            }`}
          >
            {mailbox.address}
          </button>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Message list**

`web/components/MessageList.tsx`:
```typescript
"use client";

type Email = {
  id: string;
  from: string;
  subject: string;
  text: string | null;
  read: boolean;
  createdAt: string;
};

export function MessageList({
  emails,
  activeEmailId,
  onSelectEmail,
}: {
  emails: Email[];
  activeEmailId: string | null;
  onSelectEmail: (id: string) => void;
}) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        No messages yet
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {emails.map((email) => (
        <li key={email.id}>
          <button
            type="button"
            onClick={() => onSelectEmail(email.id)}
            className={`flex w-full flex-col gap-1 border-b border-black/5 px-4 py-3 text-left transition-colors dark:border-white/10 ${
              email.id === activeEmailId
                ? "bg-black/[.06] dark:bg-white/[.08]"
                : "hover:bg-black/[.03] dark:hover:bg-white/[.05]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`truncate text-sm ${email.read ? "text-zinc-600 dark:text-zinc-400" : "font-semibold text-foreground"}`}
              >
                {email.from}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {new Date(email.createdAt).toLocaleDateString()}
              </span>
            </div>
            <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
              {email.subject}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Reading pane**

`web/components/ReadingPane.tsx`:
```typescript
"use client";

type Email = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  starred: boolean;
};

export function ReadingPane({
  email,
  onToggleStar,
  onDelete,
}: {
  email: Email | null;
  onToggleStar: (id: string, starred: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (!email) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Select a message
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {email.subject}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            From {email.from} to {email.to.join(", ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onToggleStar(email.id, !email.starred)}
            className="rounded-md border border-black/10 px-3 py-1 text-sm transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
          >
            {email.starred ? "Unstar" : "Star"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(email.id)}
            className="rounded-md border border-black/10 px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-white/15 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </div>
      {email.html ? (
        <div dangerouslySetInnerHTML={{ __html: email.html }} />
      ) : (
        <p className="whitespace-pre-wrap text-sm">{email.text}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Inbox page wiring**

`web/app/(app)/inbox/page.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MessageList } from "@/components/MessageList";
import { ReadingPane } from "@/components/ReadingPane";

type Mailbox = { id: string; address: string };
type Email = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  read: boolean;
  starred: boolean;
  createdAt: string;
};

export default function InboxPage() {
  const router = useRouter();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mailboxes")
      .then((res) => res.json())
      .then(({ mailboxes: all }: { mailboxes: Mailbox[] }) => {
        if (all.length === 0) {
          router.push("/onboarding/mailbox");
          return;
        }
        setMailboxes(all);
        setActiveMailboxId(all[0].id);
      });
  }, [router]);

  useEffect(() => {
    if (!activeMailboxId) return;
    fetch(`/api/emails?mailboxId=${activeMailboxId}`)
      .then((res) => res.json())
      .then(({ emails: all }: { emails: Email[] }) => setEmails(all));
  }, [activeMailboxId]);

  async function handleSelectEmail(id: string) {
    setActiveEmailId(id);
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, read: true } : e))
    );
  }

  async function handleToggleStar(id: string, starred: boolean) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, starred } : e))
    );
  }

  async function handleDelete(id: string) {
    await fetch(`/api/emails/${id}`, { method: "DELETE" });
    setEmails((prev) => prev.filter((e) => e.id !== id));
    setActiveEmailId(null);
  }

  const activeEmail = emails.find((e) => e.id === activeEmailId) ?? null;

  return (
    <div className="flex h-screen">
      <Sidebar
        mailboxes={mailboxes}
        activeMailboxId={activeMailboxId}
        onSelectMailbox={(id) => {
          setActiveMailboxId(id);
          setActiveEmailId(null);
        }}
      />
      <div className="flex w-96 flex-col border-r border-black/10 dark:border-white/15">
        <MessageList
          emails={emails}
          activeEmailId={activeEmailId}
          onSelectEmail={handleSelectEmail}
        />
      </div>
      <ReadingPane
        email={activeEmail}
        onToggleStar={handleToggleStar}
        onDelete={handleDelete}
      />
    </div>
  );
}
```

- [ ] **Step 5: Manual check**

Run `npm run dev`, log in, land on `/inbox`. Expected: sidebar shows your
mailbox, message list is empty until an email is sent/received (Task 12
and manual verification in Task 13).

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/inbox/page.tsx" components/Sidebar.tsx components/MessageList.tsx components/ReadingPane.tsx
git commit -m "feat: add three-pane inbox UI"
```

---

## Task 12: Compose UI

**Files:**
- Create: `web/app/(app)/compose/page.tsx`

**Interfaces:**
- Consumes: `/api/mailboxes` (Task 8) and `POST /api/emails` (Task 10).

- [ ] **Step 1: Compose page**

`web/app/(app)/compose/page.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mailbox = { id: string; address: string };

export default function ComposePage() {
  const router = useRouter();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxId, setMailboxId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/mailboxes")
      .then((res) => res.json())
      .then(({ mailboxes: all }: { mailboxes: Mailbox[] }) => {
        setMailboxes(all);
        if (all[0]) setMailboxId(all[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const res = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId,
        to: to.split(",").map((addr) => addr.trim()).filter(Boolean),
        subject,
        text,
      }),
    });
    setSending(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Failed to send");
      return;
    }
    router.push("/inbox");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-2xl flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold text-foreground">Compose</h1>
        <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/15">
          <span className="w-16 text-zinc-500">From</span>
          <select
            value={mailboxId}
            onChange={(e) => setMailboxId(e.target.value)}
            className="flex-1 bg-transparent"
          >
            {mailboxes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.address}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/15">
          <span className="w-16 text-zinc-500">To</span>
          <input
            type="text"
            placeholder="someone@example.com, another@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            className="flex-1 bg-transparent outline-none"
          />
        </label>
        <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/15">
          <span className="w-16 text-zinc-500">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="flex-1 bg-transparent outline-none"
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={12}
          className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={sending || !mailboxId}
          className="self-start rounded-md bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Manual check**

From `/inbox`, click Compose, send to `delivered@resend.dev` (Resend's
always-succeeds sandbox address — never send test mail to a real inbox).
Expected: redirected to `/inbox`, and the new message appears in the
message list with `direction: out`, `status: sent`.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/compose/page.tsx"
git commit -m "feat: add compose UI"
```

---

## Task 13: End-to-end verification pass

No new files — this task is a manual checklist confirming the whole Phase 1
loop works together before calling it done, per the spec's testing section.

- [ ] **Step 1: Automated tests pass**

Run: `npx vitest run`
Expected: all tests pass (crypto round-trip/tamper, webhook signature
rejection).

- [ ] **Step 2: Full golden path**

Using a real Resend account and a domain you control:
1. Sign up → connect Resend → connect domain → add DNS records → verify →
   create mailbox `hello@yourdomain.com`.
2. Compose and send to `delivered@resend.dev`. Confirm it appears in the
   inbox list with `status: sent`, and check the Resend dashboard's Emails
   tab shows it delivered.
3. In the Resend dashboard, use "Send test email" (or send a real email
   from any account) to `hello@yourdomain.com`. Confirm it appears in the
   inbox within a few seconds (via the webhook), with the correct subject
   and body.
4. Click the received message, confirm it marks as read. Star it, confirm
   the star persists on reload. Delete it, confirm it disappears.

- [ ] **Step 3: Webhook resilience check**

In the Resend dashboard → Webhooks → your webhook → Events, confirm recent
deliveries show `200` responses. If any show non-200, inspect via
`resend.webhooks.events.attempts.list()` or the dashboard before considering
Phase 1 done.

- [ ] **Step 4: Commit**

If Step 2 surfaced any fixes, commit them individually with their own
messages as you go — this task has no code of its own to commit.
