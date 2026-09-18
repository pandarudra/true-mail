"use client";

import { Archive, Flag, Star, TrashSimple } from "@phosphor-icons/react";

type Email = {
  id: string;
  from: string;
  subject: string;
  text: string | null;
  read: boolean;
  starred: boolean;
  important: boolean;
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
  onToggleStar,
  onArchive,
  onDelete,
}: {
  emails: Email[];
  activeEmailId: string | null;
  selectedIds: Set<string>;
  onSelectEmail: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleStar: (id: string, starred: boolean) => void;
  onArchive: (id: string) => void;
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
      <div className="flex items-center gap-3 border-b border-black/4 px-4 py-2 dark:border-white/5">
        <input
          type="checkbox"
          aria-label="Select all messages"
          checked={allSelected}
          onChange={onToggleSelectAll}
          className="h-4 w-4 shrink-0 rounded accent-brand-800"
        />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : "From"}
        </span>
      </div>
      <ul>
        {emails.map((email) => (
          <li
            key={email.id}
            className={`group flex items-start gap-3 border-b border-black/3 px-4 py-3 transition-colors last:border-b-0 dark:border-white/4 ${
              email.id === activeEmailId
                ? "bg-brand-50 dark:bg-brand-500/10"
                : "hover:bg-black/2 dark:hover:bg-white/3"
            }`}
          >
            <input
              type="checkbox"
              aria-label={`Select message from ${email.from}`}
              checked={selectedIds.has(email.id)}
              onChange={() => onToggleSelect(email.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 h-4 w-4 shrink-0 rounded accent-brand-800"
            />
            <button
              type="button"
              aria-label={email.starred ? "Unstar" : "Star"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(email.id, !email.starred);
              }}
              className={`mt-1 shrink-0 rounded-full p-1 transition-colors ${
                email.starred
                  ? "text-amber-500"
                  : "text-zinc-300 hover:text-amber-500 dark:text-zinc-600"
              }`}
            >
              <Star size={16} weight={email.starred ? "fill" : "regular"} />
            </button>
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
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-800"
                    />
                  )}
                  <span
                    className={`truncate text-sm ${email.read ? "text-zinc-600 dark:text-zinc-400" : "font-semibold text-foreground"}`}
                  >
                    {email.from}
                  </span>
                  {email.important && (
                    <Flag
                      size={12}
                      weight="fill"
                      className="shrink-0 text-brand-500"
                      aria-label="Important"
                    />
                  )}
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
            <div className="mt-1 flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                aria-label="Archive message"
                onClick={() => onArchive(email.id)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-brand-500/10"
              >
                <Archive size={16} />
              </button>
              <button
                type="button"
                aria-label="Delete message"
                onClick={() => onDelete(email.id)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              >
                <TrashSimple size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
