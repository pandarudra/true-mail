"use client";

import { useEffect, useState } from "react";
import { DrawablyDivider } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// ─── Gmail ────────────────────────────────────────────────────────────────────

function GmailIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-border">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    </div>
  );
}

function TelegramIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#229ED9]">
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    </div>
  );
}

// ─── Connector row ─────────────────────────────────────────────────────────────

type ConnectorRowProps = {
  icon: React.ReactNode;
  name: string;
  description: string;
  statusLine: React.ReactNode;
  actions: React.ReactNode;
};

function ConnectorRow({ icon, name, description, statusLine, actions }: ConnectorRowProps) {
  return (
    <div className="flex items-center gap-4 py-4">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-text-secondary">{description}</p>
        {statusLine && <div className="mt-0.5">{statusLine}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

// ─── Gmail connector ────────────────────────────────────────────────────────

function GmailConnector() {
  const [status, setStatus] = useState<{
    connected: boolean;
    gmailEmail: string | null;
    lastSyncedAt: string | null;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/gmail/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus({ connected: false, gmailEmail: null, lastSyncedAt: null }));

    const p = new URLSearchParams(window.location.search);
    if (p.get("gmail") === "connected") setSyncMsg("Connected!");
    if (p.get("gmail") === "error") setSyncMsg("Connection failed — try again.");
  }, []);

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    const res = await fetch("/api/gmail/sync", { method: "POST" });
    setSyncing(false);
    if (res.ok) {
      const { synced } = (await res.json()) as { synced: number };
      setSyncMsg(`${synced} new email${synced !== 1 ? "s" : ""} synced`);
      setStatus((s) => s && { ...s, lastSyncedAt: new Date().toISOString() });
    } else {
      setSyncMsg("Sync failed");
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setDisconnecting(false);
    setConfirmOpen(false);
    setStatus({ connected: false, gmailEmail: null, lastSyncedAt: null });
    setSyncMsg(null);
  }

  const statusLine = status?.connected ? (
    <p className="text-xs text-emerald-600 dark:text-emerald-400">
      {status.gmailEmail}
      {syncMsg && <span className="ml-2 text-text-secondary">· {syncMsg}</span>}
    </p>
  ) : syncMsg ? (
    <p className="text-xs text-text-secondary">{syncMsg}</p>
  ) : null;

  const actions = status?.connected ? (
    <>
      <Button type="button" variant="secondary" onClick={sync} disabled={syncing} className="text-xs">
        {syncing ? "Syncing…" : "Sync"}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setConfirmOpen(true)} className="text-xs">
        Disconnect
      </Button>
    </>
  ) : (
    <a href="/api/gmail/connect">
      <Button type="button" className="text-xs">Connect</Button>
    </a>
  );

  return (
    <>
      <ConnectorRow
        icon={<GmailIcon />}
        name="Gmail"
        description="Read your Google emails inside TrueMail"
        statusLine={statusLine}
        actions={actions}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Disconnect Gmail?"
        message="Removes your Gmail mailbox and all synced emails. Your Google account is not affected."
        confirmLabel={disconnecting ? "Disconnecting…" : "Disconnect"}
        onConfirm={disconnect}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// ─── Telegram connector ─────────────────────────────────────────────────────

function TelegramConnector() {
  const [status, setStatus] = useState<{
    connected: boolean;
    username: string | null;
    connectedAt: string | null;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/telegram/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus({ connected: false, username: null, connectedAt: null }));
  }, []);

  async function connect() {
    setConnecting(true);
    setError(null);
    const res = await fetch("/api/telegram/link-token", { method: "POST" });
    setConnecting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "Couldn't start linking.");
      return;
    }
    const { deepLink } = (await res.json()) as { deepLink: string };
    window.open(deepLink, "_blank", "noopener,noreferrer");
  }

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/telegram/disconnect", { method: "POST" });
    setDisconnecting(false);
    setConfirmOpen(false);
    setStatus({ connected: false, username: null, connectedAt: null });
  }

  const statusLine = status?.connected ? (
    <p className="text-xs text-emerald-600 dark:text-emerald-400">
      {status.username ? `@${status.username}` : "Connected"}
    </p>
  ) : error ? (
    <p className="text-xs text-red-600">{error}</p>
  ) : null;

  const actions = status?.connected ? (
    <Button type="button" variant="secondary" onClick={() => setConfirmOpen(true)} className="text-xs">
      Disconnect
    </Button>
  ) : (
    <Button type="button" onClick={connect} disabled={connecting} className="text-xs">
      {connecting ? "Connecting…" : "Connect"}
    </Button>
  );

  return (
    <>
      <ConnectorRow
        icon={<TelegramIcon />}
        name="Telegram"
        description="Daily digests, tasks, and email updates in Telegram"
        statusLine={statusLine}
        actions={actions}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Disconnect Telegram?"
        message="You'll stop receiving TrueMail updates on this Telegram account."
        confirmLabel={disconnecting ? "Disconnecting…" : "Disconnect"}
        onConfirm={disconnect}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

export function ConnectorsSection() {
  return (
    <div>
      <DrawablyDivider roughness={0.3} boil={0.1} className="my-6" />
      <h2 className="mb-1 text-sm font-semibold text-foreground">Connectors</h2>
      <p className="mb-3 text-xs text-text-secondary">Connect external services to TrueMail.</p>
      <div className="divide-y divide-border rounded-xl border border-border">
        <div className="px-4">
          <GmailConnector />
        </div>
        <div className="px-4">
          <TelegramConnector />
        </div>
      </div>
    </div>
  );
}
