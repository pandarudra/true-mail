"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { usePromiseStore, type PromiseDirection } from "@/lib/stores/promise-store";

export function NewPromiseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="New promise">
      {/* Rendering the form only while open remounts it fresh each time,
          same as NewTaskDialog — fields reset without an effect to sync them. */}
      {open && <NewPromiseForm onClose={onClose} />}
    </Dialog>
  );
}

function NewPromiseForm({ onClose }: { onClose: () => void }) {
  const fetchPromises = usePromiseStore((s) => s.fetchPromises);

  const [direction, setDirection] = useState<PromiseDirection>("INCOMING");
  const [commitment, setCommitment] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = commitment.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/promises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction,
        commitment: trimmed,
        personName: personName.trim() || null,
        personEmail: personEmail.trim() || null,
        // Local-midnight construction, same as NewTaskDialog's date input —
        // not `new Date(dueDate)` alone, which reads "YYYY-MM-DD" as UTC.
        dueAt: dueDate ? new Date(`${dueDate}T00:00`).toISOString() : null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create promise.");
      return;
    }
    await fetchPromises();
    onClose();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "INCOMING" as const, label: "Someone promised me" },
            { id: "OUTGOING" as const, label: "I promised someone" },
          ]
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setDirection(id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              direction === id
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                : "border-border text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Input
        type="text"
        value={commitment}
        onChange={(e) => setCommitment(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="What was promised?"
        autoFocus
      />

      <div className="flex flex-wrap gap-2">
        <Input
          type="text"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder="Their name"
          className="min-w-0 flex-1"
        />
        <Input
          type="email"
          value={personEmail}
          onChange={(e) => setPersonEmail(e.target.value)}
          placeholder="Their email"
          className="min-w-0 flex-1"
        />
      </div>
      {direction === "OUTGOING" && (
        <p className="text-xs text-text-secondary">Leave both blank if this is a promise to yourself, like a personal goal.</p>
      )}

      <input
        type="date"
        aria-label="Due date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="min-h-11 w-fit rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="button" onClick={submit} disabled={submitting || !commitment.trim()} className="w-fit">
        {submitting ? "Tracking…" : "Track Promise"}
      </Button>
    </div>
  );
}
