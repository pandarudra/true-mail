"use client";

import { useState } from "react";
import {
  CalendarBlank,
  CheckCircle,
  PencilSimpleLine,
  Plus,
  Stack,
  Sun,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { useTaskStore, type SmartView } from "@/lib/stores/task-store";
import { DrawablyButton } from "drawably/react";

const LIST_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const SMART_VIEWS: Array<{ id: SmartView; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "upcoming", label: "Upcoming", icon: CalendarBlank },
  { id: "overdue", label: "Overdue", icon: WarningCircle },
  { id: "completed", label: "Completed", icon: CheckCircle },
  { id: "all", label: "All", icon: Stack },
];

export function TaskListNav() {
  const activeView = useTaskStore((s) => s.activeView);
  const selectSmartView = useTaskStore((s) => s.selectSmartView);
  const selectList = useTaskStore((s) => s.selectList);
  const taskLists = useTaskStore((s) => s.taskLists);
  const createList = useTaskStore((s) => s.createList);
  const renameList = useTaskStore((s) => s.renameList);
  const deleteList = useTaskStore((s) => s.deleteList);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = taskLists.find((l) => l.id === editingId) ?? null;

  return (
    <>
      {/* Below lg: a horizontal scrollable pill bar, matching the app's
          mobile-first single-column layout — the vertical sidebar below
          would otherwise eat most of a phone's width. Renaming/deleting a
          list from here is intentionally left out: it's a low-frequency
          action, and the icons that trigger it rely on :hover (desktop
          only) anyway, so it's reached from the lg+ layout instead. */}
      <nav
        className="flex shrink-0 gap-2 overflow-x-auto border-b border-border p-3 lg:hidden"
        aria-label="Views and lists"
      >
        {SMART_VIEWS.map(({ id, label, icon: Icon }) => {
          const active = activeView.kind === "smart" && activeView.smart === id;
          return (
            <DrawablyButton
              roughness={0.2}
              boil={0.9}
              key={id}
              type="button"
              onClick={() => selectSmartView(id)}
              variant={active ? "solid" : "outline"}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-500 text-white"
                  : "bg-surface-subtle text-text-secondary"
              }`}
            >
              <Icon size={15} weight={active ? "fill" : "regular"} />
              {label}
            </DrawablyButton>
          );
        })}
        {taskLists.length > 0 && (
          <span className="my-auto h-5 w-px shrink-0 bg-border" />
        )}
        {taskLists.map((list) => {
          const active =
            activeView.kind === "list" && activeView.listId === list.id;
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => selectList(list.id)}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                active
                  ? "border-foreground text-foreground"
                  : "border-border text-text-secondary"
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: list.color }}
              />
              {list.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Create list"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-text-secondary"
        >
          <Plus size={16} />
        </button>
      </nav>

      <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-border p-4 lg:flex">
        <nav className="flex flex-col gap-1">
          {SMART_VIEWS.map(({ id, label, icon: Icon }) => {
            const active =
              activeView.kind === "smart" && activeView.smart === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectSmartView(id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                    : "text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} />
                {label}
              </button>
            );
          })}
        </nav>

        <p className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Lists
        </p>
        <nav className="flex flex-col gap-1">
          {taskLists.map((list) => (
            <div key={list.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => selectList(list.id)}
                className={`flex flex-1 items-center gap-3 truncate rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  activeView.kind === "list" && activeView.listId === list.id
                    ? "bg-surface-subtle font-medium text-foreground"
                    : "text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: list.color }}
                />
                <span className="flex-1 truncate">{list.name}</span>
              </button>
              <div className="hidden shrink-0 gap-0.5 group-hover:flex">
                <IconButton
                  label={`Rename ${list.name}`}
                  onClick={() => setEditingId(list.id)}
                  className="h-6 w-6"
                >
                  <PencilSimpleLine size={12} />
                </IconButton>
                {!list.isDefault && (
                  <IconButton
                    label={`Delete ${list.name}`}
                    tone="danger"
                    onClick={() => deleteList(list.id)}
                    className="h-6 w-6"
                  >
                    <X size={12} />
                  </IconButton>
                )}
              </div>
            </div>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle"
        >
          <Plus size={16} />
          Create list
        </button>
      </aside>

      <Dialog
        open={editing !== null}
        onClose={() => setEditingId(null)}
        title="Rename list"
      >
        {editing && (
          <ListForm
            initialName={editing.name}
            initialColor={editing.color}
            onSubmit={(name, color) => {
              renameList(editing.id, name, color);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        )}
      </Dialog>
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Create list"
      >
        <ListForm
          onSubmit={async (name, color) => {
            const { error } = await createList(name, color);
            if (!error) setCreating(false);
          }}
          submitLabel="Create"
        />
      </Dialog>
    </>
  );
}

function ListForm({
  initialName = "",
  initialColor = LIST_COLORS[0],
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  initialColor?: string;
  submitLabel?: string;
  onSubmit: (name: string, color: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="List name"
        autoFocus
      />
      <div className="flex flex-wrap gap-1.5">
        {LIST_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={submit} className="w-fit">
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="w-fit"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
