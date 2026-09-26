"use client";

import { useEffect, useState } from "react";
import { DrawablyCard, DrawablyDivider } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Image from "next/image";

type Status = {
  connected: boolean;
  username: string | null;
  connectedAt: string | null;
};

export function TelegramSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/telegram/status")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStatus)
      .catch(() =>
        setStatus({ connected: false, username: null, connectedAt: null }),
      );
  }, []);

  async function connect() {
    setConnecting(true);
    setError(null);
    const res = await fetch("/api/telegram/link-token", { method: "POST" });
    setConnecting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't start Telegram linking.");
      return;
    }
    const { deepLink } = await res.json();
    setDeepLink(deepLink);
    window.open(deepLink, "_blank", "noopener,noreferrer");
  }

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/telegram/disconnect", { method: "POST" });
    setDisconnecting(false);
    setConfirmOpen(false);
    setDeepLink(null);
    setStatus({ connected: false, username: null, connectedAt: null });
  }

  return (
    <div id="telegram" className="scroll-mt-8">
      <DrawablyDivider roughness={0.3} boil={0.1} className="my-6" />
      <h2 className="mb-3 text-sm font-semibold text-foreground">Telegram</h2>
      <DrawablyCard
        roughness={0.3}
        boil={0.1}
        className="bg-surface-subtle p-4"
      >
        <div className="flex items-start gap-3">
          <Image src="/icons/tg-icon.png" alt="" height={20} width={20} className="mt-0.5 shrink-0 rounded-[3px]" />
          <div className="min-w-0 flex-1">
            {status?.connected ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  Connected{status.username ? ` as @${status.username}` : ""}
                </p>
                {status.connectedAt && (
                  <p className="text-xs text-text-secondary">
                    Since {new Date(status.connectedAt).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                Get daily summaries, tasks, and email updates from a Telegram
                bot.
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          {status?.connected ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmOpen(true)}
            >
              Disconnect
            </Button>
          ) : (
            <Button type="button" onClick={connect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect Telegram"}
            </Button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {deepLink && !status?.connected && (
          <p className="mt-2 text-xs text-text-secondary">
            Didn&apos;t open?{" "}
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 underline dark:text-brand-300"
            >
              Tap here to open Telegram
            </a>
            .
          </p>
        )}
      </DrawablyCard>
      <ConfirmDialog
        open={confirmOpen}
        title="Disconnect Telegram?"
        message="You'll stop receiving TrueMail updates on this Telegram account."
        confirmLabel={disconnecting ? "Disconnecting…" : "Disconnect"}
        onConfirm={disconnect}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
