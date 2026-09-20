"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useTaskStore, type TaskList } from "@/lib/stores/task-store";

function isoAtLocalMidnight(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export function AddToTaskDialog({
  open,
  onClose,
  emailId,
  defaultTitle,
}: {
  open: boolean;
  onClose: () => void;
  emailId: string;
  defaultTitle: string;
}) {
  const taskLists = useTaskStore((s) => s.taskLists);
  const fetchTaskLists = useTaskStore((s) => s.fetchTaskLists);

  // Fetching (an external system) belongs in an effect; the fields below
  // don't — they're derived fresh per email via the form's `key` instead.
  useEffect(() => {
    if (open && taskLists.length === 0) void fetchTaskLists();
  }, [open, taskLists.length, fetchTaskLists]);

  return (
    <Dialog open={open} onClose={onClose} title="Add to Tasks">
      {open && (
        <AddToTaskForm
          key={emailId}
          emailId={emailId}
          defaultTitle={defaultTitle}
          taskLists={taskLists}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function AddToTaskForm({
  emailId,
  defaultTitle,
  taskLists,
  onClose,
}: {
  emailId: string;
  defaultTitle: string;
  taskLists: TaskList[];
  onClose: () => void;
}) {
  const createTask = useTaskStore((s) => s.createTask);
  const [title, setTitle] = useState(defaultTitle);
  const [listId, setListId] = useState("");
  const [dueAt, setDueAt] = useState<string | null>(null);
  // Falls back to the first list live during render, so a list that loads
  // in after this form mounts (the dialog can open before fetchTaskLists
  // resolves) is picked up without needing an effect to sync it into state.
  const selectedListId = listId || taskLists[0]?.id || "";

  async function submit() {
    if (!title.trim()) return;
    await createTask({
      title: title.trim(),
      listId: selectedListId || undefined,
      dueAt,
      dueHasTime: false,
      sourceEmailId: emailId,
    });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3">
      <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Today", value: isoAtLocalMidnight(0) },
          { label: "Tomorrow", value: isoAtLocalMidnight(1) },
          { label: "Next week", value: isoAtLocalMidnight(7) },
          { label: "No due date", value: null },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setDueAt(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              dueAt === opt.value
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10"
                : "border-border text-text-secondary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <Select aria-label="List" value={selectedListId} onChange={(e) => setListId(e.target.value)}>
        {taskLists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </Select>
      <Button type="button" onClick={submit} className="w-fit" disabled={!title.trim()}>
        Add task
      </Button>
    </div>
  );
}
