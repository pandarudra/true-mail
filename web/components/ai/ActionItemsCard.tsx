"use client";

import { useState } from "react";
import { CheckSquare, Robot } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { readError } from "@/lib/api-error";
import { useTaskStore } from "@/lib/stores/task-store";

export function ActionItemsCard({ emailId }: { emailId: string }) {
  const createTask = useTaskStore((s) => s.createTask);

  const [actions, setActions] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (actions) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai/extract-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const { actions: found } = await res.json();
    setActions(found);
    setChecked(new Set(found.map((_: string, i: number) => i)));
    setOpen(true);
  }

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function createTasks() {
    if (!actions) return;
    setCreating(true);
    await Promise.all(
      actions.filter((_, i) => checked.has(i)).map((title) => createTask({ title, sourceEmailId: emailId }))
    );
    setCreating(false);
    setCreated(true);
  }

  return (
    <div className="mb-4">
      <Button type="button" variant="secondary" onClick={handleClick} disabled={loading}>
        <Robot size={16} />
        {loading ? "Detecting…" : open && actions ? "Hide action items" : "Detect action items"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {open && actions && (
        <div className="mt-3 rounded-xl border border-border bg-surface-subtle p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
            <Robot size={14} />
            AI detected action items
          </div>
          {actions.length === 0 ? (
            <p className="text-sm text-text-secondary">Nothing actionable found in this email.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {actions.map((action, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Checkbox checked={checked.has(i)} onChange={() => toggle(i)} disabled={created} />
                    <span className="text-sm text-foreground">{action}</span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                onClick={createTasks}
                disabled={creating || created || checked.size === 0}
                className="mt-3"
              >
                <CheckSquare size={14} />
                {created ? "Tasks created" : creating ? "Creating…" : "Create Tasks"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
