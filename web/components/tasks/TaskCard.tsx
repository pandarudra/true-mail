"use client";

import { useRef, useState, type TouchEvent } from "react";
import {
  CheckCircle,
  Clock,
  EnvelopeSimple,
  TrashSimple,
} from "@phosphor-icons/react";
import { DrawablyCard } from "drawably/react";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Priority, Task } from "@/lib/stores/task-store";
import Image from "next/image";

// A fixed left-edge color fill instead of a text pill — reads at a glance,
// same priority always the same color. NORMAL gets no accent (the common
// case shouldn't compete visually with the ones that need attention).
const PRIORITY_ACCENT: Partial<Record<Priority, string>> = {
  LOW: "border-l-slate-300 dark:border-l-slate-600",
  HIGH: "border-l-amber-500",
  URGENT: "border-l-red-600",
};

const SWIPE_COMPLETE_THRESHOLD = 72;
const SWIPE_MAX = 96;
// Below this many px of movement, a touch is still a tap (opening the task,
// tapping the checkbox) rather than the start of a swipe.
const SWIPE_AXIS_LOCK_SLOP = 6;

function formatDue(dueAt: string, dueHasTime: boolean): string {
  return new Date(dueAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(dueHasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

// The premium mobile card treatment for a task — priority accent, subtask
// progress, due date, linked-email badge, swipe-right-to-complete — all
// real fields already on `Task`. Shared by TaskList.tsx (mobile) and
// CalClient.tsx's day-detail list, which previously duplicated near-identical
// flat rows.
export function TaskCard({
  task,
  onToggleComplete,
  onOpen,
  onDelete,
}: {
  task: Task;
  onToggleComplete: (completed: boolean) => void;
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const doneSubtasks = task.subtasks.filter((s) => s.completed).length;
  const overdue =
    !task.completed && task.dueAt !== null && new Date(task.dueAt) < new Date();
  const accentClass = PRIORITY_ACCENT[task.priority];

  // ponytail: hand-rolled touch tracking (no gesture library installed, and
  // one swipe interaction doesn't justify adding one). `touch-pan-y` on the
  // wrapper is what actually keeps vertical list scrolling working — it
  // tells the browser to handle vertical pans itself, so JS only ever needs
  // to care about the horizontal axis once a gesture is decided.
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);

  function handleTouchStart(e: TouchEvent) {
    if (task.completed) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    axis.current = null;
    setSwiping(true);
  }

  function handleTouchMove(e: TouchEvent) {
    if (!touchStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (
      axis.current === null &&
      (Math.abs(dx) > SWIPE_AXIS_LOCK_SLOP ||
        Math.abs(dy) > SWIPE_AXIS_LOCK_SLOP)
    ) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis.current === "x") {
      setSwipeX(Math.max(0, Math.min(dx, SWIPE_MAX)));
    }
  }

  function handleTouchEnd() {
    if (swipeX >= SWIPE_COMPLETE_THRESHOLD) {
      onToggleComplete(true);
    }
    setSwiping(false);
    setSwipeX(0);
    touchStart.current = null;
    axis.current = null;
  }

  return (
    <div className="relative touch-pan-y">
      {swipeX > 0 && (
        <div
          className="absolute inset-0 flex items-center gap-2 rounded-2xl bg-emerald-500 pl-4"
          style={{ opacity: Math.min(swipeX / SWIPE_COMPLETE_THRESHOLD, 1) }}
        >
          <CheckCircle size={18} weight="fill" className="text-white" />
          <span className="text-sm font-medium text-white">Complete</span>
        </div>
      )}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeX > 0 ? `translateX(${swipeX}px)` : undefined,
          transition: swiping ? "none" : "transform 200ms ease-out",
        }}
      >
        <DrawablyCard
          roughness={0.3}
          boil={0.1}
          className={`border-l-4 bg-surface p-3 ${accentClass ?? "border-l-transparent"}`}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              checked={task.completed}
              onChange={(e) => onToggleComplete(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={onOpen}
                disabled={!onOpen}
                className={`min-w-0 text-left text-sm font-medium disabled:cursor-default ${
                  task.completed
                    ? "text-text-muted line-through"
                    : "text-foreground"
                }`}
              >
                <span className="line-clamp-2">{task.title}</span>
              </button>

              {task.subtasks.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar
                    value={doneSubtasks}
                    max={task.subtasks.length}
                    className="max-w-32"
                  />
                  <span className="shrink-0 text-xs text-text-secondary">
                    {doneSubtasks}/{task.subtasks.length}
                  </span>
                </div>
              )}

              {(task.dueAt || task.sourceEmail) && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {task.dueAt && (
                    <span
                      className={`flex items-center gap-1 ${overdue ? "text-red-600" : "text-text-secondary"}`}
                    >
                      <Clock size={12} />
                      {formatDue(task.dueAt, task.dueHasTime)}
                    </span>
                  )}
                  {task.sourceEmail && (
                    <span className="flex items-center gap-1 text-text-secondary">
                      <EnvelopeSimple size={12} />
                      From
                      <Image
                        src="/icon.png"
                        alt=""
                        width={4}
                        height={4}
                        className="h-5 w-5 rounded-lg"
                      />
                    </span>
                  )}
                </div>
              )}
            </div>
            {onDelete && (
              <IconButton
                label="Delete task"
                tone="danger"
                onClick={onDelete}
                className="h-7 w-7 shrink-0"
              >
                <TrashSimple size={13} />
              </IconButton>
            )}
          </div>
        </DrawablyCard>
      </div>
    </div>
  );
}
