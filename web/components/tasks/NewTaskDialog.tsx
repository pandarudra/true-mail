"use client";

import { useState } from "react";
import { Robot } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { readError } from "@/lib/api-error";
import { useTaskStore, type Priority } from "@/lib/stores/task-store";

function isoAtLocalMidnight(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

export function NewTaskDialog({
  open,
  onClose,
  defaultListId,
}: {
  open: boolean;
  onClose: () => void;
  defaultListId?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="New task">
      {/* Rendering the form only while open remounts it fresh each time,
          so fields reset without needing an effect to sync them. */}
      {open && <NewTaskForm defaultListId={defaultListId} onClose={onClose} />}
    </Dialog>
  );
}

function NewTaskForm({ defaultListId, onClose }: { defaultListId?: string; onClose: () => void }) {
  const taskLists = useTaskStore((s) => s.taskLists);
  const createTask = useTaskStore((s) => s.createTask);

  const [title, setTitle] = useState("");
  const [listId, setListId] = useState(defaultListId ?? "");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [dueHasTime, setDueHasTime] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const selectedListId = listId || taskLists[0]?.id || "";

  async function submit() {
    if (!title.trim()) return;
    await createTask({
      title: title.trim(),
      listId: selectedListId || undefined,
      priority,
      dueAt,
      dueHasTime,
    });
    onClose();
  }

  // Prefills the form from a typed sentence — never auto-creates the task,
  // so the user still reviews and submits it themselves (same "review
  // before commit" posture as the AI reply drafts).
  async function parseWithAi() {
    if (!title.trim()) return;
    setParsing(true);
    setParseError(null);
    const res = await fetch("/api/ai/parse-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: title.trim() }),
    });
    setParsing(false);
    if (!res.ok) {
      setParseError(await readError(res));
      return;
    }
    const parsed = await res.json();
    setTitle(parsed.title);
    setDueAt(parsed.dueAt);
    setDueHasTime(!!parsed.dueHasTime);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder='Task title, or describe it — "send proposal tomorrow at 6pm"'
          autoFocus
          className="min-w-0 flex-1"
        />
        <IconButton label="Parse with AI" onClick={parseWithAi} disabled={parsing || !title.trim()}>
          <Robot size={16} />
        </IconButton>
      </div>
      {parseError && <p className="text-xs text-red-600">{parseError}</p>}
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
            onClick={() => {
              setDueAt(opt.value);
              setDueHasTime(false);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${
              dueAt === opt.value
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10"
                : "border-border text-text-secondary"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {dueAt && dueHasTime && (
          <span className="rounded-full border border-brand-500 bg-brand-50 px-3 py-1 text-xs text-brand-700 dark:bg-brand-500/10">
            {new Date(dueAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
        <Select aria-label="List" value={selectedListId} onChange={(e) => setListId(e.target.value)}>
          {taskLists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="button" onClick={submit} className="w-fit" disabled={!title.trim()}>
        Add task
      </Button>
    </div>
  );
}
