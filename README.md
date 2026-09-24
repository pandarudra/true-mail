<img src="web/public/icon.png" alt="TrueMail icon" width="72" height="72">

# TrueMail

Email infrastructure you actually own.

TrueMail is a self-hosted-friendly email client that runs on **your own domain** and **your own [Resend](https://resend.com) account**. Instead of another walled-garden inbox, it's a fast, modern inbox on top of infrastructure you control — your credentials are encrypted and never leave the backend, and every inbound webhook is signature-verified before it's touched.

## Features

- **Custom domain** — add a domain, verify SPF/DKIM/DMARC, send from an address that's actually yours
- **BYO Resend** — connect your own Resend account via OAuth; credentials are encrypted at rest and only ever used server-side
- **Multiple mailboxes** — run as many addresses as you need on one domain, with a primary you can switch anytime
- **A real inbox** — starred, important, archive, spam, trash, all mail, labels with colors, search
- **Drafts that autosave** — debounced autosave while composing, resume any draft later
- **Reply, reply-all, and forward** — direction-aware recipients and quoted replies
- **Attachments** — uploaded via Cloudinary for outgoing mail; incoming attachments are fetched from Resend on demand (no duplicate storage)
- **Tasks** — a task manager built into the inbox: due dates (quick presets or a custom date picker), priorities, lists, subtasks, and Today/Upcoming/Overdue/Completed views. Add a task straight from an email via the reading pane, and it stays linked back to the email it came from
- **Calendar** — a real month view with today auto-highlighted, national and regional holidays for whichever country you pick (via [Calendarific](https://calendarific.com), cached server-side), and tasks shown and manageable right on their due date
- **Dark mode**, a hand-drawn UI (via [Drawably](https://www.npmjs.com/package/drawably)), and a profile with a custom avatar
- **Responsive** — the inbox, compose, settings, tasks, calendar, and landing page all adapt down to phone-sized screens
- **AI assist** (optional, needs `NVIDIA_API_KEY`) — summarize an open email, draft a reply by intent (accept/decline/ask for details/thank/follow up/custom), ask your inbox a question and jump straight to the cited emails, extract an email's action items straight into one-click tasks, turn a plain-language sentence ("follow up with John tomorrow at 6pm") into a task with the right title and due date, or quietly check an open email in the background for a schedulable event (an interview, a meeting) and offer to add it to your calendar. Every call is user-triggered except that last background check; nothing else runs without a click

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- [Prisma 7](https://www.prisma.io) on PostgreSQL (developed against [Supabase](https://supabase.com))
- [better-auth](https://www.better-auth.com) — email/password + Google OAuth
- [Resend](https://resend.com) — sending, receiving (webhooks), and attachment storage for inbound mail
- [Cloudinary](https://cloudinary.com) (via `next-cloudinary`) — attachment storage for outgoing mail
- [Calendarific](https://calendarific.com) — holiday data for the calendar, cached in Postgres
- Tailwind CSS v4, [Drawably](https://www.npmjs.com/package/drawably) for the hand-drawn UI chrome
- [Vitest](https://vitest.dev) for unit tests

> **Note for contributors:** this project pins a very recent Next.js version with breaking changes from what most training data covers. Read [`web/AGENTS.md`](web/AGENTS.md) before making changes to routing, data fetching, or config.

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase's free tier works well — you'll need both the pooled and direct connection strings)
- A [Resend](https://resend.com) account
- A [Cloudinary](https://cloudinary.com) account (only needed for attachments)
- A Google OAuth client (only needed for "Sign in with Google")

### Setup

```bash
git clone https://github.com/pandarudra/true-mail.git
cd true-mail/web
npm install
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` / `DIRECT_URL` — your Postgres connection strings
- `ENCRYPTION_KEY` — 32 random bytes, base64-encoded:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `BETTER_AUTH_SECRET` — generate the same way
- `APP_URL` / `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev
- `RESEND_WEBHOOK_BASE_URL` — a public HTTPS tunnel to your dev server (e.g. `ngrok http 3000`), so Resend can deliver webhooks locally
- `RESEND_OAUTH_CLIENT_ID` / `RESEND_OAUTH_CLIENT_SECRET` — TrueMail's own OAuth client for the "Connect with Resend" button (see below)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional, for Google sign-in
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — optional, for attachments
- `NVIDIA_API_KEY` — optional, for AI features (a free-tier key from [build.nvidia.com](https://build.nvidia.com))
- `CALENDARFIC_API_KEY` — optional, for the calendar's holiday data (a free-tier key from [calendarific.com](https://calendarific.com); the env var is spelled `CALENDARFIC`, not `CALENDARIFIC` — matches the name already used in `lib/holidays/calendarific.ts`)

Register your own Resend OAuth client (one-time, re-run whenever `APP_URL` changes):

```bash
node scripts/register-resend-oauth-client.mjs http://localhost:3000
```

Run migrations and start the dev server:

```bash
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

Run these from `web/`:

| Command                                                   | Description                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                                             | Start the dev server (Turbopack)                                         |
| `npm run build`                                           | Production build                                                         |
| `npm run start`                                           | Start the production server                                              |
| `npm run lint`                                            | ESLint                                                                   |
| `npm run test`                                            | Run the Vitest suite                                                     |
| `node scripts/register-resend-oauth-client.mjs <APP_URL>` | Register/update TrueMail's Resend OAuth client                           |
| `node scripts/cleanup-orphaned-webhooks.mjs [--delete]`   | Report (or remove) Resend webhooks that don't match a current connection |

### Project structure

```
web/
├─ app/            # Next.js App Router — pages and API routes
│  ├─ (app)/       # Authenticated app: inbox, compose, tasks, calendar, settings, onboarding
│  └─ api/         # Route handlers
├─ components/      # React components (UI primitives under components/ui/)
├─ lib/             # Server/client helpers — auth, Resend wrappers, crypto, etc.
├─ prisma/          # Schema and migrations
└─ scripts/         # One-off maintenance scripts
```

## API documentation

The REST API is documented as an OpenAPI 3.0 spec at [`web/public/openapi.json`](web/public/openapi.json), served statically at `/openapi.json`. Browse it with Swagger UI at `/api` (e.g. [http://localhost:3000/api](http://localhost:3000/api) in local dev) — covers domains, mailboxes, emails, drafts, labels, attachments, and the Resend connection/webhook endpoints. Auth (`/api/auth/*`) and the Resend OAuth redirect steps aren't included; those are covered by better-auth's own docs.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for how to get set up and submit changes.

## Security

Found a vulnerability? Please see [SECURITY.md](SECURITY.md) rather than opening a public issue.

## License

[MIT](LICENSE)
