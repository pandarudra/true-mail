"use client";

import { ArrowClockwise, CheckSquare, MagnifyingGlass, TrashSimple } from "@phosphor-icons/react";

const today = new Date().toLocaleDateString(undefined, {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function InboxToolbar({
  totalCount,
  unreadCount,
  selectedCount,
  query,
  onQueryChange,
  onRefresh,
  onMarkAllRead,
  onDeleteSelected,
  refreshing,
}: {
  totalCount: number;
  unreadCount: number;
  selectedCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onDeleteSelected: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="border-b border-black/10 px-6 py-4 dark:border-white/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
          <p className="text-sm text-zinc-500">
            {totalCount} {totalCount === 1 ? "message" : "messages"}
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
          </p>
        </div>
        <span className="text-sm text-zinc-500">{today}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search messages"
            className="w-full rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-white/10 dark:bg-white/[.03]"
          />
        </div>
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={onDeleteSelected}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
          >
            <TrashSimple size={16} />
            Delete ({selectedCount})
          </button>
        ) : (
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/[.03] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/[.05]"
          >
            <CheckSquare size={16} />
            Mark all read
          </button>
        )}
        <button
          type="button"
          aria-label="Refresh"
          onClick={onRefresh}
          className="rounded-lg border border-black/10 p-2 text-zinc-600 transition-colors hover:bg-black/[.03] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/[.05]"
        >
          <ArrowClockwise size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
