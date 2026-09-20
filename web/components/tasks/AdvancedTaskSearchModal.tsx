"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { buildTaskSearchQuery } from "@/lib/task-search-query";
import { useTaskStore } from "@/lib/stores/task-store";

const EMPTY = {
  listId: "",
  priority: "" as "" | "LOW" | "NORMAL" | "HIGH" | "URGENT",
  status: "" as "" | "active" | "completed",
  include: "",
  exclude: "",
  after: "",
  before: "",
  scope: "current" as "current" | "all",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

export function AdvancedTaskSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const taskLists = useTaskStore((s) => s.taskLists);
  const setQuery = useTaskStore((s) => s.setQuery);
  const selectSmartView = useTaskStore((s) => s.selectSmartView);
  const [filters, setFilters] = useState(EMPTY);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleClear() {
    setFilters(EMPTY);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (filters.scope === "all") selectSmartView("all");
    const list = taskLists.find((l) => l.id === filters.listId);
    setQuery(buildTaskSearchQuery({ ...filters, listName: list?.name ?? "" }));
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Search tasks">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="List">
          <Select value={filters.listId} onChange={(e) => update("listId", e.target.value)}>
            <option value="">Any list</option>
            {taskLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={filters.priority}
            onChange={(e) => update("priority", e.target.value as typeof filters.priority)}
          >
            <option value="">Any priority</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select
            value={filters.status}
            onChange={(e) => update("status", e.target.value as typeof filters.status)}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </Select>
        </Field>
        <Field label="Includes the words">
          <Input type="text" value={filters.include} onChange={(e) => update("include", e.target.value)} />
        </Field>
        <Field label="Doesn't have">
          <Input type="text" value={filters.exclude} onChange={(e) => update("exclude", e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <Field label="Due after">
            <Input type="date" value={filters.after} onChange={(e) => update("after", e.target.value)} />
          </Field>
          <Field label="Due before">
            <Input type="date" value={filters.before} onChange={(e) => update("before", e.target.value)} />
          </Field>
        </div>
        <Field label="Search">
          <Select value={filters.scope} onChange={(e) => update("scope", e.target.value as "current" | "all")}>
            <option value="current">Current view</option>
            <option value="all">All tasks</option>
          </Select>
        </Field>
        <div className="mt-1 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClear}>
            Clear
          </Button>
          <Button type="submit" variant="primary">
            <MagnifyingGlass size={16} />
            Search
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
