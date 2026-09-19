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
import { useInboxStore, type Email, type Label } from "@/lib/stores/inbox-store";

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
  const closeReadingPane = useInboxStore((s) => s.closeReadingPane);
  const toggleStar = useInboxStore((s) => s.toggleStar);
  const toggleImportant = useInboxStore((s) => s.toggleImportant);
  const archive = useInboxStore((s) => s.archive);
  const toggleSpam = useInboxStore((s) => s.toggleSpam);
  const deleteEmail = useInboxStore((s) => s.deleteEmail);
  const setEmailLabels = useInboxStore((s) => s.setEmailLabels);

  const safeHtml = useMemo(
    () => (email.html ? DOMPurify.sanitize(email.html) : null),
    [email]
  );

  const isTrashed = !!email.trashedAt;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-3">
        <IconButton label="Back to list" onClick={closeReadingPane}>
          <ArrowLeft size={18} />
        </IconButton>
        {!isTrashed && (
          <div className="flex gap-1">
            <ActionButton
              label="Reply"
              onClick={() => router.push(`/compose?replyTo=${email.id}&mode=reply`)}
            >
              <ArrowBendUpLeft size={16} />
            </ActionButton>
            <ActionButton
              label="Reply all"
              onClick={() => router.push(`/compose?replyTo=${email.id}&mode=replyAll`)}
            >
              <ArrowBendDoubleUpLeft size={16} />
            </ActionButton>
            <ActionButton
              label="Forward"
              onClick={() => router.push(`/compose?replyTo=${email.id}&mode=forward`)}
            >
              <ArrowBendUpRight size={16} />
            </ActionButton>
          </div>
        )}
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
      </div>
      <DrawablyDivider roughness={0.3} boil={0.1} />
      <div className="flex-1 overflow-y-auto p-8">
        <h2 className="text-xl font-semibold text-foreground">{email.subject}</h2>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              {initialOf(email.from)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{email.from}</p>
              <p className="truncate text-xs text-text-secondary">to {email.to.join(", ")}</p>
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
