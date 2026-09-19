# Deploying to Vercel

This guide covers deploying TrueMail to [Vercel](https://vercel.com). It assumes you already have a working local setup — see the [README](README.md#getting-started) first if not.

## Before you start

You'll need production-ready versions of everything local dev uses:

- A **Vercel account**, with this repo pushed to GitHub (or GitLab/Bitbucket)
- A **PostgreSQL database** reachable from Vercel — Supabase works well and is what this project was built against
- A **Resend account**
- A **Cloudinary account** (only if you want attachments)
- A **Google OAuth client** (only if you want "Sign in with Google")

## 1. Import the project

In the Vercel dashboard, **Add New → Project**, and import the repo.

**Set the Root Directory to `web`.** The Next.js app lives at `web/`, not the repo root — Vercel won't find it otherwise. This is under Project Settings → General → Root Directory, or the equivalent prompt during import.

Vercel auto-detects Next.js and fills in the build/install commands correctly once the root directory is set — you shouldn't need to override them. (`npm install` triggers a `postinstall` script that runs `prisma generate`, so the Prisma client is always regenerated fresh on each deploy — the generated client is gitignored on purpose.)

## 2. Environment variables

Set these under Project Settings → Environment Variables. Most map directly to `.env.example`, with a few production-specific differences called out below.

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Your pooled (pgbouncer, transaction mode) connection string |
| `DIRECT_URL` | Your direct connection string (used for migrations, not at runtime) |
| `ENCRYPTION_KEY` | **Generate a fresh one** — don't reuse your local dev key. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `BETTER_AUTH_SECRET` | **Generate a fresh one**, same command |
| `APP_URL` | Your production URL, e.g. `https://truemail.example.com` or the `*.vercel.app` domain |
| `NEXT_PUBLIC_APP_URL` | Same as `APP_URL` |
| `RESEND_WEBHOOK_BASE_URL` | **Omit this entirely in production.** It exists only to point webhooks at a local tunnel during dev; the webhook-registration route falls back to `APP_URL` when it's unset, which is what you want once `APP_URL` is your real domain. |
| `RESEND_OAUTH_CLIENT_ID` / `RESEND_OAUTH_CLIENT_SECRET` | From step 3 below |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — see step 4 |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Optional — from your Cloudinary dashboard |

Redeploy after changing environment variables — Vercel doesn't hot-reload them into an already-running deployment.

## 3. Register TrueMail's Resend OAuth client for production

The "Connect with Resend" button uses an OAuth client that's registered against a specific redirect URI, which must match `APP_URL` exactly. Run this **from your local machine**, pointed at your production URL:

```bash
cd web
node scripts/register-resend-oauth-client.mjs https://your-production-domain.com
```

Copy the printed `RESEND_OAUTH_CLIENT_ID` / `RESEND_OAUTH_CLIENT_SECRET` into Vercel's environment variables.

If you later add or change a custom domain, re-run this script with the new URL and update the env vars again — a stale redirect URI is the most common cause of "Connect with Resend" silently failing after a domain change.

## 4. Google OAuth redirect URI (optional)

If you're using Google sign-in, add this to your Google Cloud Console OAuth client's **Authorized redirect URIs**:

```
https://your-production-domain.com/api/auth/callback/google
```

## 5. Run migrations

Vercel's build step does **not** run database migrations — don't wire `prisma migrate deploy` into the build command. Concurrent or rolled-back deployments racing a migration is a good way to corrupt a production schema. Instead, run it manually (or from CI) before each deploy that includes a schema change:

```bash
cd web
DIRECT_URL="<your production DIRECT_URL>" npx prisma migrate deploy
```

This applies any migrations that haven't been applied yet — it's safe to run even when there's nothing new.

## 6. Deploy

Push to your production branch (or trigger a deploy from the Vercel dashboard). Once it's live:

1. Sign up and complete onboarding: connect Resend, add and verify a domain, create a mailbox.
2. Send yourself a test email and confirm it arrives.
3. Reply to it from another account and confirm the inbound webhook delivers it back into TrueMail.

If step 3 doesn't work, double-check `APP_URL` is your real production URL (not `localhost`) and that you connected Resend *after* deploying with the correct env vars — the webhook URL is registered at connection time, so a Resend connection made during local testing won't automatically start pointing at production.

## Troubleshooting

- **Build fails with a Prisma Client error** — make sure the Root Directory is set to `web` and that `npm install` (not a custom install command that skips scripts) is actually running; the `postinstall` hook is what generates the client.
- **"domain is not verified" when sending** — DNS propagation can take a while after adding the records; TrueMail checks live status against Resend, not a cached value, so it corrects itself once DNS actually resolves.
- **"no Resend connection" after redeploying with a new domain** — reconnect Resend from the app; see the note at the end of step 6.
- **Orphaned Resend webhooks after reconnecting several times** — run `node scripts/cleanup-orphaned-webhooks.mjs` (see the [README](README.md#scripts)) to find and remove them.
