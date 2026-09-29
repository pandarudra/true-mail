"use client";

import { useState } from "react";
import { DrawablyCard } from "drawably/react";
import type { Citation, ProposedAction } from "@/lib/ai/orchestrator-shared";

export type DisplayTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; citations: Citation[]; actions: ProposedAction[] }
  | { role: "error"; content: string };

function ActionButton({ action }: { action: ProposedAction }) {
  const [state, setState] = useState<"idle" | "creating" | "done" | "error">("idle");

  async function run() {
    setState("creating");
    const url = action.type === "create_task" ? "/api/tasks" : "/api/promises";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.params),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === "creating" || state === "done"}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        state === "done"
          ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
          : "border-brand-500 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
      }`}
    >
      {state === "creating" ? "Creating…" : state === "done" ? "Created" : state === "error" ? "Try again" : action.label}
    </button>
  );
}

export function AiMessageBubble({ turn }: { turn: DisplayTurn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-brand-500 px-4 py-2 text-sm text-white">{turn.content}</div>
      </div>
    );
  }

  if (turn.role === "error") {
    return <p className="text-sm text-red-600">{turn.content}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-pre-wrap text-sm text-foreground">{turn.content}</p>

      {turn.citations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {turn.citations.map((c) => (
            <a key={c.emailId} href={`/inbox?emailId=${c.emailId}`} className="block">
              <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface p-3 transition-colors hover:bg-surface-subtle">
                <p className="truncate text-xs font-medium text-foreground">{c.subject}</p>
                <p className="truncate text-xs text-text-secondary">{c.from}</p>
                <p className="mt-1 truncate text-xs text-text-muted">{c.snippet}</p>
              </DrawablyCard>
            </a>
          ))}
        </div>
      )}

      {turn.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {turn.actions.map((action, i) => (
            <ActionButton key={i} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
