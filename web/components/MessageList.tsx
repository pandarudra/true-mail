"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CaretLeft,
  CaretRight,
  Flag,
  Paperclip,
  Star,
  TrashSimple,
} from "@phosphor-icons/react";
import { DrawablyDivider, DrawablyPager } from "drawably/react";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { useFilteredEmails, useInboxStore } from "@/lib/stores/inbox-store";

const PAGE_SIZE = 25;

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

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-1 h-4 w-4 shrink-0 animate-pulse rounded bg-surface-subtle" />
      <div className="mt-1 h-4 w-4 shrink-0 animate-pulse rounded-full bg-surface-subtle" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-32 animate-pulse rounded bg-surface-subtle" />
          <div className="h-3 w-10 animate-pulse rounded bg-surface-subtle" />
        </div>
        <div className="h-3 w-2/5 animate-pulse rounded bg-surface-subtle" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-surface-subtle" />
      </div>
    </div>
  );
}

function MessageListSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden" aria-busy="true" aria-label="Loading messages">
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="h-4 w-4 animate-pulse rounded bg-surface-subtle" />
        <div className="h-3 w-16 animate-pulse rounded bg-surface-subtle" />
      </div>
      <DrawablyDivider roughness={0.3} boil={0.1} className="mx-4" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i}>
          <SkeletonRow />
          {i < 7 && <DrawablyDivider roughness={0.3} boil={0.1} className="mx-4" />}
        </div>
      ))}
    </div>
  );
}

export function MessageList() {
  const router = useRouter();
  const emails = useFilteredEmails();
  const loading = useInboxStore((s) => s.loading);
  const activeFolder = useInboxStore((s) => s.activeFolder);
  const activeEmailId = useInboxStore((s) => s.activeEmailId);
  const selectedIds = useInboxStore((s) => s.selectedIds);
  const selectEmail = useInboxStore((s) => s.selectEmail);
  const toggleSelect = useInboxStore((s) => s.toggleSelect);
  const toggleSelectAll = useInboxStore((s) => s.toggleSelectAll);
  const toggleStar = useInboxStore((s) => s.toggleStar);
  const archive = useInboxStore((s) => s.archive);
  const deleteEmail = useInboxStore((s) => s.deleteEmail);

  const [page, setPage] = useState(0);

  if (loading && emails.length === 0) {
    return <MessageListSkeleton />;
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
        No messages here
      </div>
    );
  }

  function handleRowClick(id: string) {
    if (activeFolder === "drafts") {
      router.push(`/compose?draft=${id}`);
      return;
    }
    void selectEmail(id);
  }

  const allSelected = emails.length > 0 && selectedIds.size === emails.length;
  const pageCount = Math.max(1, Math.ceil(emails.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageEmails = emails.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center gap-3 px-4 py-2">
          <Checkbox aria-label="Select all messages" checked={allSelected} onChange={toggleSelectAll} />
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "From"}
          </span>
        </div>
        <DrawablyDivider roughness={0.3} boil={0.1} className="mx-4" />
        <ul>
          {pageEmails.map((email, i) => (
            <li key={email.id} className="group">
            <div
              className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                email.id === activeEmailId ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-surface-subtle"
              }`}
            >
              <Checkbox
                aria-label={`Select message from ${email.from}`}
                checked={selectedIds.has(email.id)}
                onChange={() => toggleSelect(email.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
              <IconButton
                label={email.starred ? "Unstar" : "Star"}
                stroke={email.starred ? "#f59e0b" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStar(email.id, !email.starred);
                }}
                className="mt-1 h-7 w-7 shrink-0"
              >
                <Star size={16} weight={email.starred ? "fill" : "regular"} />
              </IconButton>
              <button
                type="button"
                onClick={() => handleRowClick(email.id)}
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
                      className={`truncate text-sm ${email.read ? "text-text-secondary" : "font-semibold text-foreground"}`}
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
                    {email.labels.map((label) => (
                      <span
                        key={label.id}
                        aria-label={label.name}
                        title={label.name}
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                    ))}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {email.attachments.length > 0 && (
                      <Paperclip size={12} className="text-text-secondary" aria-label="Has attachment" />
                    )}
                    <span className="font-mono text-xs tabular-nums text-text-secondary">
                      {formatDate(email.createdAt)}
                    </span>
                  </span>
                </div>
                <span className="truncate text-sm text-text-secondary">{email.subject}</span>
                <span className="truncate text-xs text-text-secondary">{snippet(email.text)}</span>
              </button>
              <div className="mt-1 flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <IconButton label="Archive message" onClick={() => archive(email.id)} className="h-7 w-7">
                  <Archive size={16} />
                </IconButton>
                <IconButton
                  label="Delete message"
                  tone="danger"
                  onClick={() => deleteEmail(email.id)}
                  className="h-7 w-7"
                >
                  <TrashSimple size={16} />
                </IconButton>
              </div>
            </div>
            {i < pageEmails.length - 1 && <DrawablyDivider roughness={0.3} boil={0.1} className="mx-4" />}
            </li>
          ))}
        </ul>
      </div>
      {pageCount > 1 && (
        <DrawablyPager
          active={safePage + 1}
          roughness={0.3}
          boil={0.1}
          className="flex shrink-0 items-center justify-center gap-1 border-t border-border px-4 py-2"
        >
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            aria-label="Previous page"
            className="flex h-7 w-7 items-center justify-center text-sm"
          >
            <CaretLeft size={14} />
          </button>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              aria-label={`Page ${i + 1}`}
              className="h-7 min-w-7 px-2 text-xs tabular-nums"
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage === pageCount - 1}
            onClick={() => setPage(safePage + 1)}
            aria-label="Next page"
            className="flex h-7 w-7 items-center justify-center text-sm"
          >
            <CaretRight size={14} />
          </button>
        </DrawablyPager>
      )}
    </div>
  );
}
