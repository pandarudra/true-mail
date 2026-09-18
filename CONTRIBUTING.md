# Contributing to TrueMail

Thanks for taking the time to contribute. This document covers how to get set up locally and how to submit changes.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.

## Getting set up

Follow the [Getting started](README.md#getting-started) section of the README to get a working local environment. You'll need your own Postgres database, Resend account, and (optionally) Cloudinary and Google OAuth credentials — every contributor runs against their own infrastructure, since TrueMail is BYO by design.

Before you start, read [`web/AGENTS.md`](web/AGENTS.md). This project pins a recent Next.js version with meaningful breaking changes from what most tooling and training data assumes — check the vendored docs under `web/node_modules/next/dist/docs/` before writing code that touches routing, data fetching, or config.

## Making changes

- **Branch off `main`.** Give the branch a short, descriptive name.
- **Keep the diff scoped.** One logical change per PR is easier to review and revert if needed.
- **Follow existing patterns.** Look at how neighboring code is structured (API route shape, component conventions, Prisma usage) before introducing a new one.
- **Don't add dependencies for what a few lines can do.** This codebase leans on the platform and its existing utilities before reaching for a new package.

### Database changes

If you change `prisma/schema.prisma`, generate a migration and regenerate the client:

```bash
npx prisma migrate dev --name <short_description>
npx prisma generate
```

`prisma migrate dev` doesn't always regenerate the client on its own — if TypeScript can't find fields you just added, run `prisma generate` explicitly. Restart your dev server afterward; Next.js doesn't pick up a regenerated Prisma client on its own.

### Before opening a PR

Run from `web/`:

```bash
npm run lint
npm run test
npm run build
```

All three should pass cleanly. `npm run build` also runs the TypeScript compiler, so it catches type errors `lint` doesn't.

### Commit messages

Use a short, imperative summary with a conventional prefix — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` — matching the existing history (`git log --oneline`). Explain the *why* in the body when it isn't obvious from the diff.

### Environment variables and secrets

Never commit `.env` or real credentials. If you add a new environment variable, document it in `web/.env.example` with a comment explaining what it's for.

## Submitting a pull request

1. Push your branch and open a PR against `main`.
2. Describe what changed and why — link any related issue.
3. Fill in the PR template's testing checklist honestly; "I ran it locally and it works" is fine, but say what you actually checked.
4. Be responsive to review feedback — most PRs need at least one round of changes.

## Reporting bugs and requesting features

Use the issue templates: [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md). For security vulnerabilities, see [SECURITY.md](SECURITY.md) instead of opening a public issue.
