#!/usr/bin/env node
// One-time setup: registers TrueMail as an OAuth client with Resend and
// prints the RESEND_OAUTH_CLIENT_ID / RESEND_OAUTH_CLIENT_SECRET to put in
// .env. Re-run this (and update .env) whenever APP_URL changes, since the
// registered redirect_uri must match exactly.
//
// Usage: node scripts/register-resend-oauth-client.mjs [APP_URL]

const appUrl = process.argv[2] ?? process.env.APP_URL;
if (!appUrl) {
  console.error("Usage: node scripts/register-resend-oauth-client.mjs <APP_URL>");
  process.exit(1);
}

const redirectUri = `${appUrl}/api/oauth/resend/callback`;

const res = await fetch("https://api.resend.com/oauth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_name: "TrueMail",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_basic",
    scope: "full_access",
  }),
});

const json = await res.json();
if (!res.ok) {
  console.error("Registration failed:", json);
  process.exit(1);
}

console.log(`Registered redirect_uri: ${redirectUri}\n`);
console.log("Add these to .env:\n");
console.log(`RESEND_OAUTH_CLIENT_ID="${json.client_id}"`);
console.log(`RESEND_OAUTH_CLIENT_SECRET="${json.client_secret}"`);
console.log("\nThe client secret is shown only once — save it now.");
