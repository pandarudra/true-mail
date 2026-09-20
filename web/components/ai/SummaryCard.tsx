"use client";

import { useState } from "react";
import { Robot } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { readError } from "@/lib/api-error";

type Summary = { summary: string; bullets: string[]; action: string | null };

export function SummaryCard({ emailId }: { emailId: string }) {
  const [result, setResult] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (result) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    setResult(await res.json());
    setOpen(true);
  }

  return (
    <div className="mb-4">
      <Button type="button" variant="secondary" onClick={handleClick} disabled={loading}>
        <Robot size={16} />
        {loading ? "Summarizing…" : open && result ? "Hide summary" : "Summarize"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {open && result && (
        <div className="mt-3 rounded-xl border border-border bg-surface-subtle p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
            <Robot size={14} />
            AI summary
          </div>
          <p className="text-sm text-foreground">{result.summary}</p>
          {result.bullets.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {result.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          )}
          {result.action && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
              {result.action}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
