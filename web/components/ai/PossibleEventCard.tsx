"use client";

import { useEffect, useState } from "react";
import { CalendarPlus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useTaskStore } from "@/lib/stores/task-store";

type PossibleEvent = { title: string; dueAt: string; dueHasTime: boolean };

function formatEvent(event: PossibleEvent): string {
  return new Date(event.dueAt).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    ...(event.dueHasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
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
        setOpen(true);
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

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Possible calendar event">
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
