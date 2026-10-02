"use client";

import { useEffect, useState } from "react";
import { DrawablyCard, DrawablyDivider } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Status = {
  connected: boolean;
  gmailEmail: string | null;
  lastSyncedAt: string | null;
};

export function GmailSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/gmail/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus({ connected: false, gmailEmail: null, lastSyncedAt: null }));

    // Show feedback from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") setSyncResult("Gmail connected!");
    if (params.get("gmail") === "error") setSyncResult("Connection failed — try again.");
  }, []);

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch("/api/gmail/sync", { method: "POST" });
    setSyncing(false);
    if (res.ok) {
      const { synced } = (await res.json()) as { synced: number };
      setSyncResult(`Synced ${synced} new email${synced !== 1 ? "s" : ""}.`);
      setStatus((s) => s && { ...s, lastSyncedAt: new Date().toISOString() });
    } else {
      setSyncResult("Sync failed — try again.");
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setDisconnecting(false);
    setConfirmOpen(false);
    setStatus({ connected: false, gmailEmail: null, lastSyncedAt: null });
    setSyncResult(null);
  }

  return (
    <div id="gmail" className="scroll-mt-8">
      <DrawablyDivider roughness={0.3} boil={0.1} className="my-6" />
      <h2 className="mb-3 text-sm font-semibold text-foreground">Gmail</h2>
      <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface-subtle p-4">
        <div className="flex items-start gap-3">
          {/* Google "G" logo colour block */}
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            {status?.connected ? (
              <>
                <p className="text-sm font-medium text-foreground">{status.gmailEmail}</p>
                {status.lastSyncedAt && (
                  <p className="text-xs text-text-secondary">
                    Last synced {new Date(status.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                Connect Gmail to read your Google emails in TrueMail.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          {status?.connected ? (
            <>
              <Button type="button" variant="secondary" onClick={sync} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmOpen(true)}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <a href="/api/gmail/connect">
              <Button type="button">Connect Gmail</Button>
            </a>
          )}
        </div>

        {syncResult && (
          <p className="mt-2 text-xs text-text-secondary">{syncResult}</p>
        )}
      </DrawablyCard>

      <ConfirmDialog
        open={confirmOpen}
        title="Disconnect Gmail?"
        message="This will remove your Gmail mailbox and all synced emails from TrueMail. Your actual Gmail account is not affected."
        confirmLabel={disconnecting ? "Disconnecting…" : "Disconnect"}
        onConfirm={disconnect}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
