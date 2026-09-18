#!/usr/bin/env node
// Lists each account's Resend webhooks and flags any that don't match the
// webhookId currently stored on its ResendConnection row. Orphans come from
// reconnect attempts that registered a webhook in Resend but then failed to
// write the DB row (the bug fixed in 985de4b) — Resend keeps delivering to
// them and the app 404s since no connectionId matches.
//
// Usage: node scripts/cleanup-orphaned-webhooks.mjs [--delete]
// Without --delete, this only reports. Requires DATABASE_URL and
// ENCRYPTION_KEY (reads .env).

import "dotenv/config";
import { Client } from "pg";
import { Resend } from "resend";
import { decrypt, encrypt } from "../lib/crypto.ts";
import { refreshAccessToken } from "../lib/resend-oauth.ts";

const shouldDelete = process.argv.includes("--delete");
const REFRESH_BUFFER_MS = 60_000;

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: connections } = await db.query(
  `SELECT id, "encryptedAccessToken", "encryptedRefreshToken", "accessTokenExpiresAt", scope, "webhookId"
   FROM "ResendConnection"`
);

if (connections.length === 0) {
  console.log("No ResendConnection rows — nothing to check.");
  await db.end();
  process.exit(0);
}

let orphanCount = 0;

for (const conn of connections) {
  let accessToken = decrypt(conn.encryptedAccessToken);

  if (new Date(conn.accessTokenExpiresAt).getTime() - Date.now() < REFRESH_BUFFER_MS) {
    const refreshToken = decrypt(conn.encryptedRefreshToken);
    const tokens = await refreshAccessToken(refreshToken);
    accessToken = tokens.access_token;
    await db.query(
      `UPDATE "ResendConnection"
       SET "encryptedAccessToken" = $1, "encryptedRefreshToken" = $2, "accessTokenExpiresAt" = $3, scope = $4
       WHERE id = $5`,
      [
        encrypt(tokens.access_token),
        encrypt(tokens.refresh_token),
        new Date(Date.now() + tokens.expires_in * 1000),
        tokens.scope,
        conn.id,
      ]
    );
  }

  const resend = new Resend(accessToken);
  const { data, error } = await resend.webhooks.list();
  if (error) {
    console.error(`connection ${conn.id}: failed to list webhooks — ${error.message}`);
    continue;
  }

  console.log(`\nconnection ${conn.id} (current webhookId: ${conn.webhookId})`);
  for (const hook of data.data) {
    const orphaned = hook.id !== conn.webhookId;
    if (orphaned) orphanCount++;
    console.log(
      `  ${orphaned ? "ORPHAN " : "current"}  ${hook.id}  ${hook.status}  ${hook.endpoint}`
    );
    if (orphaned && shouldDelete) {
      const { error: removeError } = await resend.webhooks.remove(hook.id);
      console.log(removeError ? `    failed to remove: ${removeError.message}` : "    removed");
    }
  }
}

await db.end();

if (orphanCount === 0) {
  console.log("\nNo orphaned webhooks found.");
} else if (!shouldDelete) {
  console.log(`\n${orphanCount} orphaned webhook(s) found. Re-run with --delete to remove them.`);
}
