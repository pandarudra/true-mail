"use client";

import { TrashSimple } from "@phosphor-icons/react";

type Email = {
  id: string;
  from: string;
  subject: string;
  text: string | null;
  read: boolean;
  createdAt: string;
};

function snippet(text: string | null): string {
  if (!text) return "";
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 100 ? `${oneLine.slice(0, 100)}...` : oneLine;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MessageList({
  emails,
  activeEmailId,
  selectedIds,
  onSelectEmail,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
}: {
  emails: Email[];
  activeEmailId: string | null;
  selectedIds: Set<string>;
  onSelectEmail: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onDelete: (id: string) => void;
}) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        No messages here
      </div>
    );
  }

  const allSelected = emails.length > 0 && selectedIds.size === emails.length;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-black/10 px-4 py-2 dark:border-white/10">
        <input
          type="checkbox"
          aria-label="Select all messages"
          checked={allSelected}
          onChange={onToggleSelectAll}
          className="h-4 w-4 shrink-0 rounded accent-indigo-600"
        />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : "From"}
        </span>
      </div>
      <ul>
        {emails.map((email) => (
          <li
            key={email.id}
            className={`group flex items-start gap-3 border-b border-black/5 px-4 py-3 transition-colors dark:border-white/5 ${
              email.id === activeEmailId
                ? "bg-indigo-50 dark:bg-indigo-500/10"
                : "hover:bg-black/[.02] dark:hover:bg-white/[.03]"
            }`}
          >
            <input
              type="checkbox"
              aria-label={`Select message from ${email.from}`}
              checked={selectedIds.has(email.id)}
              onChange={() => onToggleSelect(email.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 h-4 w-4 shrink-0 rounded accent-indigo-600"
            />
            <button
              type="button"
              onClick={() => onSelectEmail(email.id)}
              className="flex min-w-0 flex-1 flex-col gap-1 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 truncate">
                  {!email.read && (
                    <span
                      aria-label="Unread"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600"
                    />
                  )}
                  <span
                    className={`truncate text-sm ${email.read ? "text-zinc-600 dark:text-zinc-400" : "font-semibold text-foreground"}`}
                  >
                    {email.from}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatDate(email.createdAt)}
                </span>
              </div>
              <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                {email.subject}
              </span>
              <span className="truncate text-xs text-zinc-500">
                {snippet(email.text)}
              </span>
            </button>
            <button
              type="button"
              aria-label="Delete message"
              onClick={() => onDelete(email.id)}
              className="mt-1 shrink-0 rounded-md p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-red-950/30"
            >
              <TrashSimple size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
