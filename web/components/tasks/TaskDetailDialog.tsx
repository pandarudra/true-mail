"use client";

import { useState } from "react";
import { Plus, TrashSimple, X } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { useTaskStore, type Priority, type Task } from "@/lib/stores/task-store";

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

function toDateInputValue(dueAt: string | null): string {
  if (!dueAt) return "";
  return dueAt.slice(0, 10);
}

function toTimeInputValue(dueAt: string | null): string {
  if (!dueAt) return "";
  return new Date(dueAt).toTimeString().slice(0, 5);
}

export function TaskDetailDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const taskLists = useTaskStore((s) => s.taskLists);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const createSubtask = useTaskStore((s) => s.createSubtask);
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const deleteSubtask = useTaskStore((s) => s.deleteSubtask);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");

  if (!task) return null;

  function setDue(dateStr: string, timeStr: string) {
    if (!task) return;
    if (!dateStr) {
      updateTask(task.id, { dueAt: null, dueHasTime: false });
      return;
    }
    const iso = timeStr ? new Date(`${dateStr}T${timeStr}`).toISOString() : new Date(`${dateStr}T00:00`).toISOString();
    updateTask(task.id, { dueAt: iso, dueHasTime: !!timeStr });
  }

  return (
    <>
      <Dialog open={task !== null} onClose={onClose} title="Task">
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <Input
            type="text"
            defaultValue={task.title}
            key={`title-${task.id}`}
            onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && updateTask(task.id, { title: e.target.value.trim() })}
          />
          <textarea
            defaultValue={task.description ?? ""}
            key={`desc-${task.id}`}
            placeholder="Description"
            rows={3}
            onBlur={(e) => updateTask(task.id, { description: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-surface p-2.5 text-sm text-foreground"
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              defaultValue={toDateInputValue(task.dueAt)}
              key={`date-${task.id}`}
              onChange={(e) => setDue(e.target.value, toTimeInputValue(task.dueAt))}
              className="min-h-11 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
            />
            <input
              type="time"
              defaultValue={toTimeInputValue(task.dueAt)}
              key={`time-${task.id}`}
              disabled={!task.dueAt}
              onChange={(e) => setDue(toDateInputValue(task.dueAt), e.target.value)}
              className="min-h-11 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground disabled:opacity-50"
            />
            <Select
              aria-label="Priority"
              value={task.priority}
              onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
            >
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="List"
              value={task.listId}
              onChange={(e) => updateTask(task.id, { listId: e.target.value })}
            >
              {taskLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </Select>
          </div>

          {task.sourceEmail && (
            <a
              href={`/inbox?emailId=${task.sourceEmail.id}`}
              className="w-fit rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-subtle"
            >
              Open source email: {task.sourceEmail.subject}
            </a>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Subtasks</p>
            <div className="flex flex-col gap-1">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="group flex items-center gap-2">
                  <Checkbox
                    checked={subtask.completed}
                    onChange={(e) => toggleSubtask(task.id, subtask.id, e.target.checked)}
                  />
                  <span className={`flex-1 text-sm ${subtask.completed ? "text-text-muted line-through" : "text-foreground"}`}>
                    {subtask.title}
                  </span>
                  <IconButton
                    label="Delete subtask"
                    onClick={() => deleteSubtask(task.id, subtask.id)}
                    className="hidden h-6 w-6 group-hover:flex"
                  >
                    <X size={12} />
                  </IconButton>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !newSubtask.trim()) return;
                  createSubtask(task.id, newSubtask.trim());
                  setNewSubtask("");
                }}
                placeholder="Add subtask…"
              />
              <IconButton
                label="Add subtask"
                onClick={() => {
                  if (!newSubtask.trim()) return;
                  createSubtask(task.id, newSubtask.trim());
                  setNewSubtask("");
                }}
              >
                <Plus size={14} />
              </IconButton>
            </div>
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmingDelete(true)}
            className="w-fit"
          >
            <TrashSimple size={14} />
            Delete task
          </Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete task"
        message={`Delete "${task.title}"? This can't be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          deleteTask(task.id);
          setConfirmingDelete(false);
          onClose();
        }}
      />
    </>
  );
}
