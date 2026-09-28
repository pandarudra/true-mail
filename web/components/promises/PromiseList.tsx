"use client";

import { useEffect, useState } from "react";
import { Handshake, Plus } from "@phosphor-icons/react";
import { DrawablyButton, DrawablyCard } from "drawably/react";
import { IconButton } from "@/components/ui/IconButton";
import { NewPromiseDialog } from "@/components/promises/NewPromiseDialog";
import {
  usePromiseStore,
  filteredPromises,
  type PromiseFilter,
  type PromiseRecord,
} from "@/lib/stores/promise-store";

const FILTERS: { id: PromiseFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "waiting", label: "Waiting on others" },
  { id: "mine", label: "My promises" },
  { id: "due_soon", label: "Due soon" },
  { id: "overdue", label: "Overdue" },
  { id: "fulfilled", label: "Fulfilled" },
];

// Same status-color convention used for TaskCard's priority accent and the
// Productivity Snapshot: emerald=good, amber=warning, red=critical. Exported
// for CalClient's day-list promise rows, so the color mapping lives in one place.
export const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-slate-400",
  DUE_SOON: "bg-amber-500",
  OVERDUE: "bg-red-600",
  FULFILLED: "bg-emerald-500",
  DISMISSED: "bg-slate-300",
};

export function formatDue(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function PromiseList({ onOpen }: { onOpen: (promise: PromiseRecord) => void }) {
  const promises = usePromiseStore((s) => s.promises);
  const loading = usePromiseStore((s) => s.loading);
  const activeFilter = usePromiseStore((s) => s.activeFilter);
  const setFilter = usePromiseStore((s) => s.setFilter);
  const init = usePromiseStore((s) => s.init);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  const visible = filteredPromises(promises, activeFilter);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-1.5">
        <nav className="flex flex-1 flex-wrap gap-1.5" aria-label="Filter promises">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === id
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-border text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        {/* Mirrors TaskList.tsx: inline "+" on desktop, floating FAB below
            (mobile has no room for an inline button in the filter row). */}
        <IconButton label="Track a promise" onClick={() => setCreating(true)} className="hidden shrink-0 sm:flex">
          <Plus size={16} />
        </IconButton>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-text-secondary">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-12 text-center">
          <Handshake size={22} className="text-text-muted" />
          <div>
            <p className="text-sm font-medium text-foreground">No promises here</p>
            <p className="max-w-xs text-sm text-text-secondary">
              TrueMail detects commitments from your emails automatically, or you can track one yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-subtle"
          >
            Track a promise
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpen(p)} className="w-full text-left">
                <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[p.derivedStatus]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{p.commitment}</p>
                      <p className="truncate text-xs text-text-secondary">
                        {p.direction === "INCOMING" ? (p.personName ?? p.personEmail ?? "Someone") : "You"}
                        {p.dueAt && ` · Due ${formatDue(p.dueAt)}`}
                      </p>
                    </div>
                  </div>
                </DrawablyCard>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Same fixed-wrapper-not-on-the-button-itself note as TaskList.tsx's
          FAB: drawably's own .drawably-host sets position:relative on the
          button element, which otherwise beats `fixed` and leaves it stuck
          in normal flow. */}
      <div className="fixed bottom-5 right-5 z-30 sm:hidden">
        <DrawablyButton
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Track a promise"
          variant="outline"
          roughness={0.3}
          boil={0.1}
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
        >
          <Plus size={24} weight="bold" />
        </DrawablyButton>
      </div>

      <NewPromiseDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
