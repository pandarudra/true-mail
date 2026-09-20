"use client";

import { useState } from "react";
import { DotsSixVertical, EnvelopeSimple, Flag, Plus, TrashSimple } from "@phosphor-icons/react";
import { DrawablyButton } from "drawably/react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { IconButton } from "@/components/ui/IconButton";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { useFilteredTasks, useTaskStore, type Priority, type Task } from "@/lib/stores/task-store";

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "text-text-muted",
  NORMAL: "text-text-secondary",
  HIGH: "text-amber-500",
  URGENT: "text-red-600",
};

function formatDue(dueAt: string, dueHasTime: boolean): string {
  const date = new Date(dueAt);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(dueHasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function TaskList({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
  const tasks = useFilteredTasks();
  const activeView = useTaskStore((s) => s.activeView);
  const createTask = useTaskStore((s) => s.createTask);
  const toggleComplete = useTaskStore((s) => s.toggleComplete);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const reorderTask = useTaskStore((s) => s.reorderTask);

  const [quickTitle, setQuickTitle] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");
  const [creatingTask, setCreatingTask] = useState(false);

  // Reordering is only meaningful within a single real list — a smart view
  // (Today/Upcoming/...) can span many lists, where "position" has no single
  // reference frame.
  const listId = activeView.kind === "list" ? activeView.listId : null;
  const visibleTasks = priorityFilter === "ALL" ? tasks : tasks.filter((t) => t.priority === priorityFilter);
  // Position indices are computed against the full (unfiltered) list, so
  // dragging is only safe when the priority filter isn't narrowing what's shown.
  const dragEnabled = listId !== null && priorityFilter === "ALL";

  async function submitQuickAdd() {
    const title = quickTitle.trim();
    if (!title) return;
    setQuickTitle("");
    await createTask(listId ? { title, listId } : { title });
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
      {/* Below sm: no inline toolbar at all — quick-add and the priority
          filter are both too cramped to be usable on a phone-width screen.
          A fixed bottom-right FAB (rendered further down) replaces the
          inline "+" button as the mobile entry point for creating a task;
          the priority filter's job is covered by the TopBar's advanced
          task search on mobile. */}
      <div className="mb-4 hidden flex-wrap items-center gap-2 sm:flex">
        <Input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitQuickAdd()}
          placeholder="Add a task…"
          className="min-w-0 flex-1"
        />
        <Select
          aria-label="Filter by priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | "ALL")}
          className="w-auto shrink-0"
        >
          <option value="ALL">All priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </Select>
        <IconButton label="New task" onClick={() => setCreatingTask(true)}>
          <Plus size={16} />
        </IconButton>
      </div>
      <ul className="flex flex-col gap-1">
        {visibleTasks.map((task) => (
          <li
            key={task.id}
            draggable={dragEnabled}
            onDragStart={() => setDraggingId(task.id)}
            onDragOver={(e) => dragEnabled && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragEnabled || !listId || !draggingId || draggingId === task.id) return;
              const targetIndex = visibleTasks.findIndex((t) => t.id === task.id);
              void reorderTask(draggingId, listId, targetIndex);
              setDraggingId(null);
            }}
            className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-subtle"
          >
            {dragEnabled && (
              // Native HTML5 drag-and-drop doesn't respond to touch, so the
              // handle would be a non-functional affordance on mobile.
              <DotsSixVertical size={14} className="hidden shrink-0 cursor-grab text-text-muted sm:flex" />
            )}
            <Checkbox
              checked={task.completed}
              onChange={(e) => toggleComplete(task.id, e.target.checked)}
            />
            <button
              type="button"
              onClick={() => onOpenTask(task)}
              className={`flex min-w-0 flex-1 items-center gap-2 text-left text-sm ${
                task.completed ? "text-text-muted line-through" : "text-foreground"
              }`}
            >
              <span className="truncate">{task.title}</span>
              {task.sourceEmail && <EnvelopeSimple size={13} className="shrink-0 text-text-muted" />}
            </button>
            {task.priority !== "NORMAL" && (
              <Flag size={14} weight="fill" className={`shrink-0 ${PRIORITY_COLOR[task.priority]}`} />
            )}
            {task.dueAt && (
              <span
                className={`shrink-0 whitespace-nowrap text-xs ${
                  !task.completed && new Date(task.dueAt) < new Date() ? "text-red-600" : "text-text-secondary"
                }`}
              >
                {formatDue(task.dueAt, task.dueHasTime)}
              </span>
            )}
            <IconButton
              label="Delete task"
              tone="danger"
              onClick={() => deleteTask(task.id)}
              // Always reachable on touch (no :hover there); fades in on
              // hover only where a real pointer exists.
              className="flex h-6 w-6 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <TrashSimple size={12} />
            </IconButton>
          </li>
        ))}
        {visibleTasks.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-text-secondary">No tasks here.</li>
        )}
      </ul>
      <DrawablyButton
        type="button"
        onClick={() => setCreatingTask(true)}
        aria-label="New task"
        variant="solid"
        roughness={0.3}
        boil={0.1}
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg sm:hidden"
      >
        <Plus size={24} weight="bold" />
      </DrawablyButton>
      <NewTaskDialog
        open={creatingTask}
        onClose={() => setCreatingTask(false)}
        defaultListId={listId ?? undefined}
      />
    </div>
  );
}
