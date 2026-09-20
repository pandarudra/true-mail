"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/Input";
import { useTaskStore } from "@/lib/stores/task-store";

export function TaskSearchBar() {
  const query = useTaskStore((s) => s.query);
  const setQuery = useTaskStore((s) => s.setQuery);

  return (
    <div className="relative min-w-0 flex-1 sm:mx-auto sm:max-w-xl">
      <MagnifyingGlass
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-muted"
      />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tasks"
        className="pl-10"
      />
    </div>
  );
}
