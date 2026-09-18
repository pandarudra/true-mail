"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArrowClockwise,
  ArrowUUpLeft,
  CheckSquare,
  ShieldWarning,
  TrashSimple,
} from "@phosphor-icons/react";
import { FOLDERS, type FolderId } from "@/lib/mail-folders";

function timeAgo(date: Date, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function InboxToolbar({
  folder,
  totalCount,
  unreadCount,
  selectedCount,
  onRefresh,
  onMarkAllRead,
  onArchiveSelected,
  onSpamSelected,
  onNotSpamSelected,
  onTrashSelected,
  onRestoreSelected,
  onDeleteForeverSelected,
  onEmptyTrash,
  refreshing,
  updatedAt,
}: {
  folder: FolderId;
  totalCount: number;
  unreadCount: number;
  selectedCount: number;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onArchiveSelected: () => void;
  onSpamSelected: () => void;
  onNotSpamSelected: () => void;
  onTrashSelected: () => void;
  onRestoreSelected: () => void;
  onDeleteForeverSelected: () => void;
  onEmptyTrash: () => void;
  refreshing: boolean;
  updatedAt: Date | null;
}) {
  const label = FOLDERS.find((f) => f.id === folder)?.label ?? "Inbox";
  const hasSelection = selectedCount > 0;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-between border-b border-black/4 px-6 py-3 dark:border-white/5">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-foreground">{label}</h1>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
          {totalCount}
        </span>

        {folder === "trash" ? (
          <>
            {hasSelection && (
              <ToolbarButton onClick={onRestoreSelected} icon={ArrowUUpLeft}>
                Restore ({selectedCount})
              </ToolbarButton>
            )}
            <ToolbarButton
              onClick={hasSelection ? onDeleteForeverSelected : onEmptyTrash}
              icon={TrashSimple}
              danger
              disabled={!hasSelection && totalCount === 0}
            >
              {hasSelection ? `Delete forever (${selectedCount})` : "Empty trash"}
            </ToolbarButton>
          </>
        ) : folder === "spam" ? (
          hasSelection ? (
            <>
              <ToolbarButton onClick={onNotSpamSelected} icon={ArrowUUpLeft}>
                Not spam ({selectedCount})
              </ToolbarButton>
              <ToolbarButton onClick={onTrashSelected} icon={TrashSimple} danger>
                Delete ({selectedCount})
              </ToolbarButton>
            </>
          ) : (
            <MarkAllReadButton onClick={onMarkAllRead} disabled={unreadCount === 0} />
          )
        ) : hasSelection ? (
          <>
            <ToolbarButton onClick={onArchiveSelected} icon={Archive}>
              Archive ({selectedCount})
            </ToolbarButton>
            <ToolbarButton onClick={onSpamSelected} icon={ShieldWarning}>
              Spam
            </ToolbarButton>
            <ToolbarButton onClick={onTrashSelected} icon={TrashSimple} danger>
              Delete ({selectedCount})
            </ToolbarButton>
          </>
        ) : (
          <MarkAllReadButton onClick={onMarkAllRead} disabled={unreadCount === 0} />
        )}
      </div>

      <div className="flex items-center gap-3">
        {updatedAt && (
          <span className="text-xs text-zinc-400">Updated {timeAgo(updatedAt, now)}</span>
        )}
        <button
          type="button"
          aria-label="Refresh"
          onClick={onRefresh}
          className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-black/3 dark:text-zinc-400 dark:hover:bg-white/5"
        >
          <ArrowClockwise size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}

function MarkAllReadButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5"
    >
      <CheckSquare size={16} />
      Mark all read
    </button>
  );
}

function ToolbarButton({
  onClick,
  icon: Icon,
  danger,
  disabled,
  children,
}: {
  onClick: () => void;
  icon: typeof TrashSimple;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          : "text-foreground hover:bg-black/3 dark:hover:bg-white/5"
      }`}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}
