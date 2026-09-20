"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import {
  Archive,
  ArrowBendDoubleUpLeft,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowLeft,
  ArrowUUpLeft,
  CaretDown,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  Flag,
  Paperclip,
  ShieldWarning,
  Star,
  Tag,
  TrashSimple,
} from "@phosphor-icons/react";
import { DrawablyBadge, DrawablyButton, DrawablyDivider } from "drawably/react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/ai/SummaryCard";
import { AiReplyBar } from "@/components/ai/AiReplyBar";
import { FOLDERS } from "@/lib/mail-folders";
import { useFilteredEmails, useInboxStore, type Email, type Label } from "@/lib/stores/inbox-store";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initialOf(address: string): string {
  return (address.match(/[a-zA-Z]/)?.[0] ?? "?").toUpperCase();
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ReadingPane({ email }: { email: Email }) {
  const router = useRouter();
  const labels = useInboxStore((s) => s.labels);
  const activeFolder = useInboxStore((s) => s.activeFolder);
  const closeReadingPane = useInboxStore((s) => s.closeReadingPane);
  const selectEmail = useInboxStore((s) => s.selectEmail);
  const toggleStar = useInboxStore((s) => s.toggleStar);
  const toggleImportant = useInboxStore((s) => s.toggleImportant);
  const archive = useInboxStore((s) => s.archive);
  const toggleSpam = useInboxStore((s) => s.toggleSpam);
  const deleteEmail = useInboxStore((s) => s.deleteEmail);
  const setEmailLabels = useInboxStore((s) => s.setEmailLabels);
  const folderEmails = useFilteredEmails();

  const safeHtml = useMemo(
    () => (email.html ? DOMPurify.sanitize(email.html) : null),
    [email]
  );

  const isTrashed = !!email.trashedAt;
  const folderLabel = FOLDERS.find((f) => f.id === activeFolder)?.label ?? "Inbox";

  const position = folderEmails.findIndex((e) => e.id === email.id);
  const prevEmail = position > 0 ? folderEmails[position - 1] : null;
  const nextEmail = position >= 0 && position < folderEmails.length - 1 ? folderEmails[position + 1] : null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
        <IconButton label="Back to list" onClick={closeReadingPane}>
          <ArrowLeft size={18} />
        </IconButton>
        <div className="flex flex-1 justify-end gap-1">
          <ActionButton
            active={email.starred}
            activeStroke="#f59e0b"
            label={email.starred ? "Unstar" : "Star"}
            onClick={() => toggleStar(email.id, !email.starred)}
          >
            <Star size={16} weight={email.starred ? "fill" : "regular"} />
          </ActionButton>
          <ActionButton
            active={email.important}
            activeStroke="var(--color-brand-700)"
            label={email.important ? "Mark not important" : "Mark important"}
            onClick={() => toggleImportant(email.id, !email.important)}
          >
            <Flag size={16} weight={email.important ? "fill" : "regular"} />
          </ActionButton>
          {!isTrashed && !email.spam && (
            <ActionButton label="Archive" onClick={() => archive(email.id)}>
              <Archive size={16} />
            </ActionButton>
          )}
          <LabelPicker email={email} labels={labels} onSetLabels={setEmailLabels} />
          <ActionButton
            label={email.spam ? "Not spam" : "Move to spam"}
            onClick={() => toggleSpam(email.id, !email.spam)}
          >
            {email.spam ? <ArrowUUpLeft size={16} /> : <ShieldWarning size={16} />}
          </ActionButton>
          <ActionButton
            label={isTrashed ? "Delete forever" : "Delete"}
            onClick={() => deleteEmail(email.id)}
            danger
          >
            <TrashSimple size={16} />
          </ActionButton>
        </div>
        {position >= 0 && (
          <div className="flex shrink-0 items-center gap-2 pl-1">
            <span className="whitespace-nowrap font-mono text-xs text-text-secondary">
              {position + 1} of {folderEmails.length}
            </span>
            <IconButton
              label="Older"
              disabled={!prevEmail}
              onClick={() => prevEmail && void selectEmail(prevEmail.id)}
            >
              <CaretLeft size={16} />
            </IconButton>
            <IconButton
              label="Newer"
              disabled={!nextEmail}
              onClick={() => nextEmail && void selectEmail(nextEmail.id)}
            >
              <CaretRight size={16} />
            </IconButton>
          </div>
        )}
      </div>
      <DrawablyDivider roughness={0.3} boil={0.1} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">{email.subject}</h2>
          <DrawablyBadge roughness={0.3} boil={0.1} className="text-xs">
            {folderLabel}
          </DrawablyBadge>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              {initialOf(email.from)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{email.from}</p>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-text-secondary hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <span className="truncate">to {email.to.join(", ")}</span>
                  <CaretDown size={10} className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 grid w-fit grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-subtle p-3 text-xs">
                  <span className="text-text-secondary">from:</span>
                  <span className="font-medium text-foreground">{email.from}</span>
                  <span className="text-text-secondary">to:</span>
                  <span className="text-foreground">{email.to.join(", ")}</span>
                  <span className="text-text-secondary">date:</span>
                  <span className="text-foreground">{formatFullDate(email.createdAt)}</span>
                  <span className="text-text-secondary">subject:</span>
                  <span className="text-foreground">{email.subject}</span>
                </div>
              </details>
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-text-secondary">
            {formatFullDate(email.createdAt)}
          </span>
        </div>
        {email.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {email.labels.map((label) => (
              <DrawablyBadge
                key={label.id}
                roughness={0.3}
                boil={0.1}
                stroke={label.color}
                className="text-xs"
              >
                {label.name}
              </DrawablyBadge>
            ))}
          </div>
        )}
        <div className="mb-6" />
        <SummaryCard emailId={email.id} />
        {safeHtml ? (
          <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          <p className="whitespace-pre-wrap text-sm">{email.text}</p>
        )}
        {email.attachments.length > 0 && (
          <ul className="mt-6 flex flex-col gap-1.5 border-t border-border pt-4">
            {email.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/emails/${email.id}/attachments/${a.id}/download`}
                  className="flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-subtle"
                >
                  <Paperclip size={14} className="shrink-0 text-text-secondary" />
                  <span className="truncate">{a.filename}</span>
                  {a.size !== null && (
                    <span className="shrink-0 text-text-secondary">({formatBytes(a.size)})</span>
                  )}
                  <DownloadSimple size={14} className="shrink-0 text-text-secondary" />
                </a>
              </li>
            ))}
          </ul>
        )}
        {!isTrashed && (
          <div className="mt-8 border-t border-border pt-6">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/compose?replyTo=${email.id}&mode=reply`)}
              >
                <ArrowBendUpLeft size={16} />
                Reply
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/compose?replyTo=${email.id}&mode=replyAll`)}
              >
                <ArrowBendDoubleUpLeft size={16} />
                Reply all
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/compose?replyTo=${email.id}&mode=forward`)}
              >
                <ArrowBendUpRight size={16} />
                Forward
              </Button>
            </div>
            <AiReplyBar emailId={email.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  active,
  activeStroke,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  activeStroke?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DrawablyButton
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      variant="outline"
      tone={danger ? "danger" : active ? undefined : "neutral"}
      stroke={active ? activeStroke : undefined}
      roughness={0.3}
      boil={0.1}
      className="drawably-icon-btn flex h-8 w-8 items-center justify-center"
    >
      {children}
    </DrawablyButton>
  );
}

function LabelPicker({
  email,
  labels,
  onSetLabels,
}: {
  email: Email;
  labels: Label[];
  onSetLabels: (id: string, labelIds: string[]) => void;
}) {
  const assignedIds = new Set(email.labels.map((l) => l.id));

  function toggle(labelId: string) {
    const next = assignedIds.has(labelId)
      ? email.labels.filter((l) => l.id !== labelId).map((l) => l.id)
      : [...email.labels.map((l) => l.id), labelId];
    onSetLabels(email.id, next);
  }

  return (
    <details className="relative">
      <summary
        aria-label="Labels"
        title="Labels"
        className="flex h-8 w-8 list-none items-center justify-center rounded-lg text-text-secondary hover:bg-surface-subtle [&::-webkit-details-marker]:hidden"
      >
        <Tag size={16} />
      </summary>
      <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-xl border border-border bg-surface p-2 shadow-lg">
        {labels.length === 0 ? (
          <p className="px-2 py-1 text-xs text-text-secondary">No labels yet</p>
        ) : (
          labels.map((label) => (
            <label
              key={label.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-subtle"
            >
              <input
                type="checkbox"
                checked={assignedIds.has(label.id)}
                onChange={() => toggle(label.id)}
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              <span className="truncate">{label.name}</span>
            </label>
          ))
        )}
      </div>
    </details>
  );
}
