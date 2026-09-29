"use client";

import { CalendarBlank, CheckSquare, EnvelopeSimple, Handshake } from "@phosphor-icons/react";
import { DrawablyCard } from "drawably/react";

const QUICK_STARTS = [
  { icon: EnvelopeSimple, label: "Emails", hint: "Ask about mail", prompt: "What emails do I need to respond to today?" },
  { icon: CheckSquare, label: "Tasks", hint: "Manage tasks", prompt: "Create tasks from my unread emails." },
  { icon: Handshake, label: "Promises", hint: "Track promises", prompt: "What promises have I made this week?" },
  { icon: CalendarBlank, label: "Calendar", hint: "Plan schedule", prompt: "What do I have on my calendar tomorrow?" },
] as const;

export function AiQuickStart({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-3">
      {QUICK_STARTS.map(({ icon: Icon, label, hint, prompt }) => (
        <button key={label} type="button" onClick={() => onPick(prompt)} className="text-left">
          <DrawablyCard roughness={0.3} boil={0.1} className="flex flex-col gap-2 bg-surface p-4 transition-colors hover:bg-surface-subtle">
            <Icon size={20} className="text-brand-600 dark:text-brand-300" />
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-text-secondary">{hint}</p>
            </div>
          </DrawablyCard>
        </button>
      ))}
    </div>
  );
}
