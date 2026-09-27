"use client";

import { useEffect, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { DrawablyCard } from "drawably/react";
import { Button } from "@/components/ui/Button";

const DISMISSED_KEY = "truemail:dismissed-fulfillments";

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
    // storage unavailable — worst case it re-checks next time
  }
}

type FulfillmentMatch = { promiseId: string; commitment: string; confidence: number };

// Spec §13: never auto-marks fulfilled from AI inference alone — this is
// purely a confirm/dismiss suggestion. Inline (not a modal): lower-stakes
// than a new promise detection, and reads better sitting inline with the
// email body it's about.
export function PossibleFulfillmentCard({ emailId }: { emailId: string }) {
  const [match, setMatch] = useState<FulfillmentMatch | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai/match-fulfillment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId }),
    })
      .then((res) => (res.ok ? res.json() : { match: null }))
      .then(({ match: found }) => {
        if (cancelled || !found || isDismissed(emailId)) return;
        setMatch(found);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [emailId]);

  async function markFulfilled() {
    if (!match) return;
    setConfirming(true);
    const res = await fetch(`/api/promises/${match.promiseId}/fulfill`, { method: "POST" });
    setConfirming(false);
    if (!res.ok) return;
    setConfirmed(true);
    setTimeout(() => setMatch(null), 1200);
  }

  function notRelated() {
    markDismissed(emailId);
    setMatch(null);
  }

  if (!match) return null;

  if (confirmed) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CheckCircle size={16} weight="fill" />
        Marked fulfilled
      </div>
    );
  }

  return (
    <DrawablyCard roughness={0.3} boil={0.1} className="mb-6 bg-surface-subtle p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
        <CheckCircle size={14} />
        Possible fulfillment detected
      </div>
      <p className="mb-3 text-sm text-foreground">This email may fulfill: {match.commitment}</p>
      <div className="flex gap-2">
        <Button type="button" onClick={markFulfilled} disabled={confirming} className="w-fit">
          {confirming ? "Marking…" : "Mark Fulfilled"}
        </Button>
        <Button type="button" variant="secondary" onClick={notRelated} className="w-fit">
          Not Related
        </Button>
      </div>
    </DrawablyCard>
  );
}
