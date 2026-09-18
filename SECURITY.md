# Security Policy

TrueMail handles other people's Resend credentials and email content, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report it privately using one of these:

- [GitHub's private vulnerability reporting](../../security/advisories/new) for this repository, or
- Email **talk@rudrax.me** with details and, if possible, steps to reproduce.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce (a minimal example is ideal)
- Any affected versions/commits you're aware of

You should get an acknowledgment within a few days. Please give a reasonable amount of time to address the issue before any public disclosure.

## Security model

A quick summary of how TrueMail protects the credentials and data it handles, so reports can be scoped accurately:

- **Resend credentials** are encrypted at rest (AES-256-GCM) and only ever decrypted server-side — the browser never receives them.
- **Webhook payloads** from Resend are signature-verified before any data is written.
- **Attachments** you send are stored in your own Cloudinary account; attachments you receive stay with Resend and are fetched via a fresh, short-lived signed URL on demand rather than being duplicated into another store.
- Every API route checks the requesting user owns the resource (mailbox, email, label, etc.) before reading or mutating it.

## Supported versions

This project doesn't yet maintain multiple release branches — security fixes are applied to `main`. If that changes, this section will be updated with a support table.
