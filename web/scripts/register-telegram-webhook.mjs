#!/usr/bin/env node
// One-time setup (and re-run whenever the tunnel/APP_URL changes): points
// the Telegram bot's webhook at this app and registers its command menu.
// Reuses RESEND_WEBHOOK_BASE_URL (the same ngrok tunnel already used for
// Resend webhooks in dev) as the public base, falling back to APP_URL.
//
// Usage: node scripts/register-telegram-webhook.mjs

import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = process.env.RESEND_WEBHOOK_BASE_URL ?? process.env.APP_URL;

if (!token || !secret || !baseUrl) {
  console.error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and APP_URL (or RESEND_WEBHOOK_BASE_URL) first.");
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  }
  return json.result;
}

await call("setWebhook", { url: webhookUrl, secret_token: secret });
console.log(`Webhook set to ${webhookUrl}`);

await call("setMyCommands", {
  commands: [
    { command: "today", description: "Your daily summary" },
    { command: "tasks", description: "Your task list" },
    { command: "summary", description: "Email summary" },
    { command: "calendar", description: "Today's calendar" },
    { command: "goal", description: "Today's focus" },
    { command: "create", description: "Create a task" },
    { command: "done", description: "Complete a task" },
    { command: "settings", description: "Connection status" },
    { command: "disconnect", description: "Unlink Telegram" },
    { command: "help", description: "What I can do" },
  ],
});
console.log("Command menu registered.");
