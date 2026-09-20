"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { buildSearchQuery } from "@/lib/search-query";
import { useInboxStore } from "@/lib/stores/inbox-store";

const EMPTY = {
  from: "",
  to: "",
  subject: "",
  include: "",
  exclude: "",
  hasAttachment: false,
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

export function AdvancedSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setQuery = useInboxStore((s) => s.setQuery);
  const selectFolder = useInboxStore((s) => s.selectFolder);
  const [filters, setFilters] = useState(EMPTY);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleClear() {
    setFilters(EMPTY);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (filters.scope === "all") selectFolder("all");
    setQuery(buildSearchQuery(filters));
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Search mail">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="From">
          <Input type="text" value={filters.from} onChange={(e) => update("from", e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="text" value={filters.to} onChange={(e) => update("to", e.target.value)} />
        </Field>
        <Field label="Subject">
          <Input type="text" value={filters.subject} onChange={(e) => update("subject", e.target.value)} />
        </Field>
        <Field label="Includes the words">
          <Input type="text" value={filters.include} onChange={(e) => update("include", e.target.value)} />
        </Field>
        <Field label="Doesn't have">
          <Input type="text" value={filters.exclude} onChange={(e) => update("exclude", e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <Field label="After">
            <Input type="date" value={filters.after} onChange={(e) => update("after", e.target.value)} />
          </Field>
          <Field label="Before">
            <Input type="date" value={filters.before} onChange={(e) => update("before", e.target.value)} />
          </Field>
        </div>
        <Field label="Search">
          <Select
            value={filters.scope}
            onChange={(e) => update("scope", e.target.value as "current" | "all")}
          >
            <option value="current">This folder</option>
            <option value="all">All Mail</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 py-1 text-sm text-foreground">
          <Checkbox
            checked={filters.hasAttachment}
            onChange={(e) => update("hasAttachment", e.target.checked)}
          />
          Has attachment
        </label>
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
