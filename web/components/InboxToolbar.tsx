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
import { DrawablyBadge, DrawablyDivider } from "drawably/react";
import { FOLDERS, type FolderId } from "@/lib/mail-folders";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";

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
    <div>
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-foreground">{label}</h1>
        <DrawablyBadge roughness={0.3} boil={0.1} className="tabular-nums">
          {totalCount}
        </DrawablyBadge>

        {folder === "trash" ? (
          <>
            {hasSelection && (
              <Button variant="secondary" onClick={onRestoreSelected}>
                <ArrowUUpLeft size={16} />
                Restore ({selectedCount})
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={hasSelection ? onDeleteForeverSelected : onEmptyTrash}
              disabled={!hasSelection && totalCount === 0}
            >
              <TrashSimple size={16} />
              {hasSelection ? `Delete forever (${selectedCount})` : "Empty trash"}
            </Button>
          </>
        ) : folder === "spam" ? (
          hasSelection ? (
            <>
              <Button variant="secondary" onClick={onNotSpamSelected}>
                <ArrowUUpLeft size={16} />
                Not spam ({selectedCount})
              </Button>
              <Button variant="destructive" onClick={onTrashSelected}>
                <TrashSimple size={16} />
                Delete ({selectedCount})
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onMarkAllRead} disabled={unreadCount === 0}>
              <CheckSquare size={16} />
              Mark all read
            </Button>
          )
        ) : hasSelection ? (
          <>
            <Button variant="secondary" onClick={onArchiveSelected}>
              <Archive size={16} />
              Archive ({selectedCount})
            </Button>
            <Button variant="secondary" onClick={onSpamSelected}>
              <ShieldWarning size={16} />
              Spam
            </Button>
            <Button variant="destructive" onClick={onTrashSelected}>
              <TrashSimple size={16} />
              Delete ({selectedCount})
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onMarkAllRead} disabled={unreadCount === 0}>
            <CheckSquare size={16} />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {updatedAt && (
          <span className="font-mono text-xs text-text-muted">Updated {timeAgo(updatedAt, now)}</span>
        )}
        <IconButton label="Refresh" onClick={onRefresh}>
          <ArrowClockwise size={16} className={refreshing ? "animate-spin" : ""} />
        </IconButton>
      </div>
    </div>
    <DrawablyDivider roughness={0.3} boil={0.1} />
    </div>
  );
}
