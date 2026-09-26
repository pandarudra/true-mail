"use client";

import { Clock, EnvelopeSimple, TrashSimple } from "@phosphor-icons/react";
import { DrawablyCard } from "drawably/react";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Priority, Task } from "@/lib/stores/task-store";

const PRIORITY_PILL: Partial<Record<Priority, string>> = {
  LOW: "bg-surface-subtle text-text-muted",
  HIGH: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  URGENT: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

function formatDue(dueAt: string, dueHasTime: boolean): string {
  return new Date(dueAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(dueHasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

// The premium mobile card treatment for a task — priority pill, subtask
// progress, due date, linked-email badge — all real fields already on
// `Task`. Shared by TaskList.tsx (mobile) and CalClient.tsx's day-detail
// list, which previously duplicated near-identical flat rows.
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
  const overdue = !task.completed && task.dueAt !== null && new Date(task.dueAt) < new Date();
  const pillClass = PRIORITY_PILL[task.priority];

  return (
    <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onChange={(e) => onToggleComplete(e.target.checked)}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={onOpen}
              disabled={!onOpen}
              className={`min-w-0 flex-1 text-left text-sm font-medium disabled:cursor-default ${
                task.completed ? "text-text-muted line-through" : "text-foreground"
              }`}
            >
              <span className="line-clamp-2">{task.title}</span>
            </button>
            {pillClass && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${pillClass}`}>
                {task.priority.toLowerCase()}
              </span>
            )}
          </div>

          {task.subtasks.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar value={doneSubtasks} max={task.subtasks.length} className="max-w-32" />
              <span className="shrink-0 text-xs text-text-secondary">
                {doneSubtasks}/{task.subtasks.length}
              </span>
            </div>
          )}

          {(task.dueAt || task.sourceEmail) && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              {task.dueAt && (
                <span className={`flex items-center gap-1 ${overdue ? "text-red-600" : "text-text-secondary"}`}>
                  <Clock size={12} />
                  {formatDue(task.dueAt, task.dueHasTime)}
                </span>
              )}
              {task.sourceEmail && (
                <span className="flex items-center gap-1 text-text-secondary">
                  <EnvelopeSimple size={12} />
                  From email
                </span>
              )}
            </div>
          )}
        </div>
        {onDelete && (
          <IconButton label="Delete task" tone="danger" onClick={onDelete} className="h-7 w-7 shrink-0">
            <TrashSimple size={13} />
          </IconButton>
        )}
      </div>
    </DrawablyCard>
  );
}
