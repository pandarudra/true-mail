"use client";

import { Star } from "@phosphor-icons/react";
import { DrawablyBadge, DrawablyCard, DrawablyDivider } from "drawably/react";

const ROWS = [
  {
    from: "Priya Nair",
    subject: "Design review notes",
    snippet: "Left a few comments on the onboarding flow, mostly around...",
    time: "9:32 AM",
    unread: true,
    starred: false,
    label: "#6957f6",
  },
  {
    from: "GitHub",
    subject: "Your PR was merged",
    snippet: "feat: add cursor pagination to the mailbox list endpoint",
    time: "Yesterday",
    unread: false,
    starred: true,
    label: null,
  },
  {
    from: "Alex Chen",
    subject: "Re: Q3 planning doc",
    snippet: "Sounds good — let's sync Thursday and lock the roadmap",
    time: "Mon",
    unread: false,
    starred: false,
    label: "#22c55e",
  },
] as const;

// A static recreation of the real inbox UI, not a generic illustration —
// same hand-drawn chrome the actual product uses, just non-interactive.
export function InboxPreview() {
  return (
    <DrawablyCard roughness={0.3} boil={0.15} className="w-full max-w-md bg-surface p-0 text-left">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Inbox</span>
        <DrawablyBadge roughness={0.3} boil={0.1} className="tabular-nums">
          3
        </DrawablyBadge>
      </div>
      <DrawablyDivider roughness={0.3} boil={0.1} className="mx-4" />
      <ul>
        {ROWS.map((row, i) => (
          <li key={row.from}>
            <div className="flex items-start gap-2.5 px-4 py-3">
              {row.unread ? (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-800" />
              ) : (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className={`truncate text-sm ${row.unread ? "font-semibold text-foreground" : "text-text-secondary"}`}
                    >
                      {row.from}
                    </span>
                    {row.label && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.label }}
                      />
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
                    {row.time}
                  </span>
                </div>
                <p className="truncate text-sm text-text-secondary">{row.subject}</p>
                <p className="truncate text-xs text-text-secondary">{row.snippet}</p>
              </div>
              {row.starred && (
                <Star size={14} weight="fill" className="mt-1 shrink-0 text-amber-500" />
              )}
            </div>
            {i < ROWS.length - 1 && <DrawablyDivider roughness={0.3} boil={0.1} className="mx-4" />}
          </li>
        ))}
      </ul>
    </DrawablyCard>
  );
}
