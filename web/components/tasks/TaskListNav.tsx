"use client";

import { useEffect, useRef, useState } from "react";
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
import { isSameDay, toISODate } from "@/lib/cal";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// ponytail: a fixed window around today, not an infinite/lazily-extended
// scroll — plenty for picking a nearby date; widen the numbers (or add
// lazy-extend-on-scroll) if people need to plan further out.
const DAYS_BEFORE_TODAY = 14;
const DAYS_AFTER_TODAY = 45;

function dayRange(center: Date, before: number, after: number): Date[] {
  const start = new Date(center.getFullYear(), center.getMonth(), center.getDate() - before);
  return Array.from({ length: before + after + 1 }, (_, i) => new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
}

// The only view switcher left on mobile (see the nav below): a horizontally
// scrollable date strip, auto-scrolled so today starts in view. Tapping a
// day shows tasks due exactly that day via activeView: {kind:"date"}.
function WeekStrip() {
  const activeView = useTaskStore((s) => s.activeView);
  const selectDate = useTaskStore((s) => s.selectDate);
  const today = new Date();
  const days = dayRange(today, DAYS_BEFORE_TODAY, DAYS_AFTER_TODAY);
  const todayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  return (
    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-3" aria-label="Pick a day">
      {days.map((day) => {
        const iso = toISODate(day);
        const selected = activeView.kind === "date" && activeView.date === iso;
        const isToday = isSameDay(day, today);
        return (
          <button
            key={iso}
            ref={isToday ? todayRef : undefined}
            type="button"
            onClick={() => selectDate(iso)}
            aria-label={day.toDateString()}
            aria-pressed={selected}
            className="flex min-w-11 shrink-0 flex-col items-center gap-1 py-0.5"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
              {WEEKDAY_LETTERS[day.getDay()]}
            </span>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                selected
                  ? "bg-brand-500 text-white"
                  : isToday
                    ? "text-brand-700 ring-1 ring-brand-500 dark:text-brand-300"
                    : "text-foreground"
              }`}
            >
              {day.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
      {/* Below lg: just the date strip — Today/Upcoming/Overdue/lists (which
          aren't dates, so they can't live in the strip itself) are reached
          from the lg+ sidebar below instead. Matches the app's mobile-first
          single-column layout either way — the vertical sidebar would
          otherwise eat most of a phone's width. */}
      <div className="lg:hidden">
        <WeekStrip />
      </div>

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
