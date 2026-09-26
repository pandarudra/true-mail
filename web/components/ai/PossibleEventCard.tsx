"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, X } from "@phosphor-icons/react";
import { DrawablyCard } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { useTaskStore } from "@/lib/stores/task-store";

type PossibleEvent = { title: string; dueAt: string; dueHasTime: boolean };

function formatEvent(event: PossibleEvent): string {
  return new Date(event.dueAt).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    ...(event.dueHasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

// Once the user closes the modal without adding it, we stop interrupting
// them for that email — later opens show a small dismissible suggestion
// instead. Persisted in localStorage (not tied to a component instance)
// since ReadingPane remounts this component every time an email is opened.
const DISMISSED_KEY = "truemail:dismissed-events";

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
    // storage unavailable (private browsing) — worst case it shows as a modal again next time
  }
}

// There's no separate Events model yet — "adding to calendar" here means
// creating a Task with this due date, which is exactly what the calendar
// already shows (see lib/holidays for the calendar's other non-task record
// type).
//
// Detection runs silently in the background as soon as an email opens — no
// button, no "nothing found" state. It only surfaces at all when there's
// something to confirm, as a modal rather than an inline card. The caller
// must render this with key={emailId} — that's what resets `event`/`open`
// between emails; ReadingPane otherwise reuses the same instance.
export function PossibleEventCard({ emailId }: { emailId: string }) {
  const createTask = useTaskStore((s) => s.createTask);

  const [event, setEvent] = useState<PossibleEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai/extract-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId, timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
    })
      .then((res) => (res.ok ? res.json() : { event: null }))
      .then(({ event: found }) => {
        if (cancelled || !found) return;
        setEvent(found);
        // Already dismissed once for this email — surface it quietly this
        // time instead of interrupting with the modal again.
        setOpen(!isDismissed(emailId));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [emailId]);

  async function addToCalendar() {
    if (!event) return;
    setAdding(true);
    await createTask({
      title: event.title,
      dueAt: event.dueAt,
      dueHasTime: event.dueHasTime,
      sourceEmailId: emailId,
    });
    setAdding(false);
    setAdded(true);
    // Brief "Added" acknowledgment (see ux guidance: a silent success is an
    // anti-pattern) before it vanishes on its own — no manual dismiss needed.
    setTimeout(() => setEvent(null), 700);
  }

  if (!event) return null;

  function dismiss() {
    setOpen(false);
    markDismissed(emailId);
  }

  if (!open) {
    return (
      <div className="fixed bottom-5 left-1/2 z-30 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 sm:left-auto sm:right-5 sm:w-auto sm:translate-x-0">
        <DrawablyCard roughness={0.3} boil={0.1} className="flex items-center gap-3 bg-surface px-4 py-2.5">
          <CalendarPlus size={16} className="shrink-0 text-text-secondary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{event.title}</p>
            <p className="truncate text-xs text-text-secondary">{formatEvent(event)}</p>
          </div>
          <Button
            type="button"
            onClick={addToCalendar}
            disabled={adding || added}
            className="shrink-0 px-2.5 py-1 text-xs"
          >
            {added ? "Added" : adding ? "Adding…" : "Add"}
          </Button>
          <IconButton label="Dismiss" onClick={() => setEvent(null)} className="h-7 w-7 shrink-0">
            <X size={14} />
          </IconButton>
        </DrawablyCard>
      </div>
    );
  }

  return (
    <Dialog open={open} onClose={dismiss} title="Possible calendar event">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{event.title}</p>
          <p className="text-sm text-text-secondary">{formatEvent(event)}</p>
        </div>
        <Button type="button" onClick={addToCalendar} disabled={adding || added} className="w-fit">
          <CalendarPlus size={14} />
          {added ? "Added to calendar" : adding ? "Adding…" : "Add to calendar"}
        </Button>
      </div>
    </Dialog>
  );
}
