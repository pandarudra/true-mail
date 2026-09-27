"use client";

import { useEffect, useState } from "react";
import { Handshake, X } from "@phosphor-icons/react";
import { DrawablyCard } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";

type PossiblePromise = {
  direction: "INCOMING" | "OUTGOING";
  personName: string | null;
  personEmail: string | null;
  commitment: string;
  dueAt: string | null;
  dueHasTime: boolean;
  confidence: number;
};

// High-confidence, explicit commitments are tracked automatically (spec:
// only "ambiguous" promises require confirmation) — everything below this
// bar shows a confirm/ignore card instead, same as PossibleEventCard.
const AUTO_TRACK_CONFIDENCE = 0.75;

const DISMISSED_KEY = "truemail:dismissed-promises";

function isDismissed(emailId: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]).includes(emailId) : false;
  } catch {
    return false;
  }
}

function markDismissed(emailId: string) {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(emailId)) localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids, emailId]));
  } catch {
    // storage unavailable (private browsing) — worst case it shows again next time
  }
}

function formatDue(dueAt: string, dueHasTime: boolean): string {
  return new Date(dueAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    ...(dueHasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

// Mirrors PossibleEventCard.tsx's lazy-detection pattern exactly (fetch on
// email open, dismiss-to-quiet-suggestion after one decline, never
// resurface once a Promise already exists for this email — enforced
// server-side by hasPromiseForEmail in the extract-promise route). The one
// difference: a confident, explicit commitment tracks itself immediately
// with a brief acknowledgment, rather than always interrupting with a
// confirm dialog — see AUTO_TRACK_CONFIDENCE above.
export function PossiblePromiseCard({ emailId }: { emailId: string }) {
  const [promise, setPromise] = useState<PossiblePromise | null>(null);
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai/extract-promise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId, timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
    })
      .then((res) => (res.ok ? res.json() : { promise: null }))
      .then(({ promise: found }) => {
        if (cancelled || !found) return;
        setPromise(found);
        if (found.confidence >= AUTO_TRACK_CONFIDENCE) {
          void track(found);
        } else {
          setOpen(!isDismissed(emailId));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId]);

  async function track(p: PossiblePromise) {
    setTracking(true);
    const res = await fetch("/api/promises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction: p.direction,
        personName: p.personName,
        personEmail: p.personEmail,
        commitment: p.commitment,
        dueAt: p.dueAt,
        confidence: p.confidence,
        sourceEmailId: emailId,
      }),
    });
    setTracking(false);
    if (!res.ok) return;
    setTracked(true);
    setTimeout(() => setPromise(null), 1200);
  }

  function dismiss() {
    setOpen(false);
    markDismissed(emailId);
  }

  if (!promise) return null;

  if (tracked) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
        <Handshake size={16} weight="fill" />
        Promise tracked: {promise.commitment}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="fixed bottom-5 left-1/2 z-30 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 sm:left-auto sm:right-5 sm:w-auto sm:translate-x-0">
        <DrawablyCard roughness={0.3} boil={0.1} className="flex items-center gap-3 bg-surface px-4 py-2.5">
          <Handshake size={16} className="shrink-0 text-text-secondary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{promise.commitment}</p>
            {promise.personName && <p className="truncate text-xs text-text-secondary">{promise.personName}</p>}
          </div>
          <Button
            type="button"
            onClick={() => track(promise)}
            disabled={tracking}
            className="shrink-0 px-2.5 py-1 text-xs"
          >
            {tracking ? "Tracking…" : "Track"}
          </Button>
          <IconButton label="Dismiss" onClick={() => setPromise(null)} className="h-7 w-7 shrink-0">
            <X size={14} />
          </IconButton>
        </DrawablyCard>
      </div>
    );
  }

  return (
    <Dialog open={open} onClose={dismiss} title="Possible promise detected">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{promise.commitment}</p>
          {promise.personName && (
            <p className="text-sm text-text-secondary">
              {promise.direction === "INCOMING" ? `From ${promise.personName}` : `To ${promise.personName}`}
            </p>
          )}
          {promise.dueAt && (
            <p className="text-sm text-text-secondary">Due {formatDue(promise.dueAt, promise.dueHasTime)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => track(promise)} disabled={tracking} className="w-fit">
            <Handshake size={14} />
            {tracking ? "Tracking…" : "Track Promise"}
          </Button>
          <Button type="button" variant="secondary" onClick={dismiss} className="w-fit">
            Ignore
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
