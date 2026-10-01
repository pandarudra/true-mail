"use client";

import { useMemo, useRef, useState } from "react";
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
  CheckSquare,
  DotsThree,
  DownloadSimple,
  Flag,
  PaperPlaneTilt,
  Paperclip,
  ShieldWarning,
  Star,
  Tag,
  TrashSimple,
  X,
} from "@phosphor-icons/react";
import { DrawablyBadge, DrawablyButton, DrawablyDivider } from "drawably/react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/ai/SummaryCard";
import { ActionItemsCard } from "@/components/ai/ActionItemsCard";
import { PossibleEventCard } from "@/components/ai/PossibleEventCard";
import { PossiblePromiseCard } from "@/components/ai/PossiblePromiseCard";
import { PossibleFulfillmentCard } from "@/components/ai/PossibleFulfillmentCard";
import { AiReplyBar } from "@/components/ai/AiReplyBar";
import { AddToTaskDialog } from "@/components/tasks/AddToTaskDialog";
import { FOLDERS } from "@/lib/mail-folders";
import { buildReplyPrefill, type ReplyMode } from "@/lib/reply";
import {
  useFilteredEmails,
  useInboxStore,
  type Email,
  type Label,
} from "@/lib/stores/inbox-store";

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

// Gmail-style avatar colors based on first letter
const AVATAR_COLORS: Record<string, string> = {
  a: "#e91e63",
  b: "#9c27b0",
  c: "#673ab7",
  d: "#3f51b5",
  e: "#2196f3",
  f: "#03a9f4",
  g: "#00bcd4",
  h: "#009688",
  i: "#4caf50",
  j: "#8bc34a",
  k: "#cddc39",
  l: "#ffc107",
  m: "#ff9800",
  n: "#ff5722",
  o: "#795548",
  p: "#607d8b",
  q: "#e91e63",
  r: "#9c27b0",
  s: "#3f51b5",
  t: "#2196f3",
  u: "#4caf50",
  v: "#ff9800",
  w: "#ff5722",
  x: "#607d8b",
  y: "#009688",
  z: "#795548",
};

function avatarColor(address: string): string {
  const letter = (address.match(/[a-zA-Z]/)?.[0] ?? "a").toLowerCase();
  return AVATAR_COLORS[letter] ?? "#6957f6";
}

export function ReadingPane({ email }: { email: Email }) {
  const [addingTask, setAddingTask] = useState(false);
  const [replyMode, setReplyMode] = useState<ReplyMode | null>(null);
  const labels = useInboxStore((s) => s.labels);
  const mailboxes = useInboxStore((s) => s.mailboxes);
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
    [email],
  );

  const isTrashed = !!email.trashedAt;
  const folderLabel =
    FOLDERS.find((f) => f.id === activeFolder)?.label ?? "Inbox";

  const position = folderEmails.findIndex((e) => e.id === email.id);
  const prevEmail = position > 0 ? folderEmails[position - 1] : null;
  const nextEmail =
    position >= 0 && position < folderEmails.length - 1
      ? folderEmails[position + 1]
      : null;

  const defaultMailbox = mailboxes.find((m) => m.isDefault) ?? mailboxes[0];

  function openReply(mode: ReplyMode) {
    setReplyMode(mode);
    // Scroll to bottom so the reply box is visible
    setTimeout(() => {
      document
        .getElementById("inline-reply-box")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  const pagination = position >= 0 && (
    <>
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
    </>
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-surface">
      {/* Toolbar row */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <IconButton label="Back to list" onClick={closeReadingPane}>
          <ArrowLeft size={18} />
        </IconButton>
        {pagination && (
          <div className="flex shrink-0 items-center gap-1">{pagination}</div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ActionButton
            active={email.starred}
            activeStroke="#f59e0b"
            label={email.starred ? "Unstar" : "Star"}
            onClick={() => toggleStar(email.id, !email.starred)}
          >
            <Star size={16} weight={email.starred ? "fill" : "regular"} />
          </ActionButton>
          {!isTrashed && !email.spam && (
            <ActionButton label="Archive" onClick={() => archive(email.id)}>
              <Archive size={16} />
            </ActionButton>
          )}
          <MoreMenu
            email={email}
            labels={labels}
            isTrashed={isTrashed}
            onAddTask={() => setAddingTask(true)}
            onToggleImportant={() => toggleImportant(email.id, !email.important)}
            onToggleSpam={() => toggleSpam(email.id, !email.spam)}
            onDelete={() => deleteEmail(email.id)}
            onSetLabels={(ids) => setEmailLabels(email.id, ids)}
          />
        </div>
      </div>

      {/* Email content area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-8">
        {/* Subject + folder badge */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            {email.subject}
          </h2>
          <DrawablyBadge roughness={0.3} boil={0.1} className="text-xs">
            {folderLabel}
          </DrawablyBadge>
        </div>

        {/* Gmail-style email card */}
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          {/* Sender header */}
          <div className="flex items-start justify-between gap-3 px-3 py-3 sm:px-5 sm:py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: avatarColor(email.from) }}
              >
                {initialOf(email.from)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {email.from}
                </p>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-text-secondary hover:text-foreground [&::-webkit-details-marker]:hidden">
                    <span className="truncate">to {email.to.join(", ")}</span>
                    <CaretDown
                      size={10}
                      className="shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="mt-2 grid w-fit grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-subtle p-3 text-xs">
                    <span className="text-text-secondary">from:</span>
                    <span className="font-medium text-foreground">
                      {email.from}
                    </span>
                    <span className="text-text-secondary">to:</span>
                    <span className="text-foreground">
                      {email.to.join(", ")}
                    </span>
                    <span className="text-text-secondary">date:</span>
                    <span className="text-foreground">
                      {formatFullDate(email.createdAt)}
                    </span>
                    <span className="text-text-secondary">subject:</span>
                    <span className="text-foreground">{email.subject}</span>
                  </div>
                </details>
              </div>
            </div>
            <span className="hidden shrink-0 whitespace-nowrap text-xs text-text-secondary sm:inline">
              {formatFullDate(email.createdAt)}
            </span>
          </div>

          {/* Labels */}
          {email.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2 sm:px-5">
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

          <DrawablyDivider roughness={0.2} boil={0.05} />

          {/* AI cards */}
          <div className="px-3 py-3 sm:px-5 sm:py-4">
            <PossibleEventCard key={email.id} emailId={email.id} />
            <PossiblePromiseCard
              key={`promise-${email.id}`}
              emailId={email.id}
            />
            <PossibleFulfillmentCard
              key={`fulfillment-${email.id}`}
              emailId={email.id}
            />
          </div>

          {/* Email body */}
          <div className="px-3 pb-4 sm:px-5 sm:pb-5">
            {safeHtml ? (
              <div
                className="prose prose-sm max-w-none text-foreground [&_a]:text-brand-600 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-text-secondary"
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                {email.text}
              </pre>
            )}
          </div>

          {/* Attachments */}
          {email.attachments.length > 0 && (
            <div className="border-t border-border px-3 py-3 sm:px-5 sm:py-4">
              <p className="mb-2 text-xs font-medium text-text-secondary">
                {email.attachments.length} attachment
                {email.attachments.length > 1 ? "s" : ""}
              </p>
              <ul className="flex flex-wrap gap-2">
                {email.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={`/api/emails/${email.id}/attachments/${a.id}/download`}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-subtle"
                    >
                      <Paperclip
                        size={14}
                        className="shrink-0 text-text-secondary"
                      />
                      <span className="truncate max-w-40">{a.filename}</span>
                      {a.size !== null && (
                        <span className="shrink-0 text-xs text-text-secondary">
                          ({formatBytes(a.size)})
                        </span>
                      )}
                      <DownloadSimple
                        size={14}
                        className="shrink-0 text-text-secondary"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-2 p-3 sm:flex-row">
            <ActionItemsCard emailId={email.id} />
            <SummaryCard emailId={email.id} />
          </div>

          {/* Reply / Forward action buttons */}
          {!isTrashed && (
            <div className="border-t border-border px-3 py-3">
              <div className="flex flex-wrap gap-2 items-center justify-start">
                <DrawablyButton
                  type="button"
                  boil={0.2}
                  roughness={0.4}
                  onClick={() => openReply("reply")}
                  className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-subtle hover:text-foreground"
                >
                  <ArrowBendUpLeft size={15} />
                  Reply
                </DrawablyButton>
                <DrawablyButton
                  type="button"
                  boil={0.2}
                  roughness={0.4}
                  onClick={() => openReply("replyAll")}
                  className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-subtle hover:text-foreground"
                >
                  <ArrowBendDoubleUpLeft size={15} />
                  Reply all
                </DrawablyButton>
                <DrawablyButton
                  boil={0.2}
                  roughness={0.4}
                  type="button"
                  onClick={() => openReply("forward")}
                  className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-subtle hover:text-foreground"
                >
                  <ArrowBendUpRight size={15} />
                  Forward
                </DrawablyButton>
                <AiReplyBar emailId={email.id} />
              </div>
            </div>
          )}
        </div>

        {/* Inline reply box */}
        {replyMode && !isTrashed && (
          <InlineReply
            id="inline-reply-box"
            email={email}
            mode={replyMode}
            mailboxes={mailboxes}
            defaultMailboxId={defaultMailbox?.id ?? ""}
            onClose={() => setReplyMode(null)}
            onSent={() => setReplyMode(null)}
          />
        )}
      </div>

      <AddToTaskDialog
        open={addingTask}
        onClose={() => setAddingTask(false)}
        emailId={email.id}
        defaultTitle={email.subject}
      />
    </div>
  );
}

function InlineReply({
  id,
  email,
  mode,
  mailboxes,
  defaultMailboxId,
  onClose,
  onSent,
}: {
  id?: string;
  email: Email;
  mode: ReplyMode;
  mailboxes: { id: string; address: string; isDefault: boolean }[];
  defaultMailboxId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const prefill = useMemo(
    () =>
      buildReplyPrefill(
        { ...email, cc: [] },
        mode,
        mailboxes.find((m) => m.id === defaultMailboxId)?.address ?? "",
      ),
    [email, mode, defaultMailboxId, mailboxes],
  );

  const [mailboxId, setMailboxId] = useState(defaultMailboxId);
  const [to, setTo] = useState(prefill.to.join(", "));
  const [cc, setCc] = useState(prefill.cc.join(", "));
  const [subject] = useState(prefill.subject);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const HEADING = { reply: "Reply", replyAll: "Reply all", forward: "Forward" };

  async function handleSend() {
    if (!to.trim() || !text.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId,
        to: to
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        cc: cc
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        subject,
        text: text + prefill.text,
      }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Failed to send");
      return;
    }
    onSent();
  }

  return (
    <div
      id={id}
      className="mt-3 rounded-xl border border-border bg-surface shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {HEADING[mode]}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-text-secondary hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* Fields */}
      <div className="divide-y divide-border">
        {mailboxes.length > 1 && (
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="w-12 shrink-0 text-xs text-text-secondary">
              From
            </span>
            <select
              value={mailboxId}
              onChange={(e) => setMailboxId(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground outline-none"
            >
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="w-12 shrink-0 text-xs text-text-secondary">To</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-text-muted"
            placeholder="recipients"
          />
        </div>
        {(mode === "replyAll" || cc) && (
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="w-12 shrink-0 text-xs text-text-secondary">
              Cc
            </span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-text-muted"
              placeholder="cc@example.com (optional)"
            />
          </div>
        )}
      </div>

      {/* Compose area */}
      <div className="px-4 py-3">
        <textarea
          ref={textareaRef}
          autoFocus
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your reply…"
          className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-text-muted"
        />
        {/* Quoted original text preview */}
        <div className="mt-2 border-l-2 border-border pl-3 text-xs text-text-secondary line-clamp-3 whitespace-pre-wrap">
          {`On ${formatFullDate(email.createdAt)}, ${email.from} wrote:\n${email.text?.slice(0, 200) ?? ""}`}
          {(email.text?.length ?? 0) > 200 && "…"}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="ml-auto flex items-center gap-2">
          <DrawablyButton
            boil={0.4}
            roughness={0.3}
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle"
          >
            Discard
          </DrawablyButton>
          <DrawablyButton
            boil={0.4}
            roughness={0.3}
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !to.trim() || !text.trim()}
            className="flex items-center gap-2 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <PaperPlaneTilt size={14} weight="bold" />
            {sending ? "Sending…" : "Send"}
          </DrawablyButton>
        </div>
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
  // ponytail: kept DrawablyButton removed to avoid import change; plain button with same visual weight
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition-colors",
        danger
          ? "text-text-secondary hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950"
          : active
            ? "text-foreground"
            : "text-text-secondary hover:bg-surface-subtle hover:text-foreground",
      ].join(" ")}
      style={active && activeStroke ? { color: activeStroke } : undefined}
    >
      {children}
    </button>
  );
}

function MoreMenu({
  email,
  labels,
  isTrashed,
  onAddTask,
  onToggleImportant,
  onToggleSpam,
  onDelete,
  onSetLabels,
}: {
  email: Email;
  labels: Label[];
  isTrashed: boolean;
  onAddTask: () => void;
  onToggleImportant: () => void;
  onToggleSpam: () => void;
  onDelete: () => void;
  onSetLabels: (ids: string[]) => void;
}) {
  const assignedIds = new Set(email.labels.map((l) => l.id));
  const [labelsOpen, setLabelsOpen] = useState(false);

  function toggleLabel(labelId: string) {
    const next = assignedIds.has(labelId)
      ? email.labels.filter((l) => l.id !== labelId).map((l) => l.id)
      : [...email.labels.map((l) => l.id), labelId];
    onSetLabels(next);
  }

  return (
    <details className="relative">
      <summary
        aria-label="More options"
        title="More options"
        className="flex h-8 w-8 list-none items-center justify-center rounded-lg text-text-secondary hover:bg-surface-subtle [&::-webkit-details-marker]:hidden"
      >
        <DotsThree size={20} weight="bold" />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-border bg-surface py-1.5 shadow-lg">
        <MenuItem icon={<CheckSquare size={15} />} onClick={onAddTask}>
          Add to Tasks
        </MenuItem>
        <MenuItem
          icon={<Flag size={15} weight={email.important ? "fill" : "regular"} />}
          onClick={onToggleImportant}
        >
          {email.important ? "Mark not important" : "Mark important"}
        </MenuItem>

        {/* Labels submenu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLabelsOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-subtle"
          >
            <Tag size={15} className="shrink-0 text-text-secondary" />
            <span className="flex-1 text-left">Labels</span>
            <CaretDown size={12} className={`shrink-0 text-text-secondary transition-transform ${labelsOpen ? "rotate-180" : ""}`} />
          </button>
          {labelsOpen && (
            <div className="border-t border-border py-1">
              {labels.length === 0 ? (
                <p className="px-4 py-1.5 text-xs text-text-secondary">No labels yet</p>
              ) : (
                labels.map((label) => (
                  <label
                    key={label.id}
                    className="flex cursor-pointer items-center gap-2.5 px-4 py-1.5 text-sm hover:bg-surface-subtle"
                  >
                    <input
                      type="checkbox"
                      checked={assignedIds.has(label.id)}
                      onChange={() => toggleLabel(label.id)}
                      className="accent-brand-600"
                    />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
                    <span className="truncate">{label.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div className="my-1 border-t border-border" />

        <MenuItem
          icon={email.spam ? <ArrowUUpLeft size={15} /> : <ShieldWarning size={15} />}
          onClick={onToggleSpam}
        >
          {email.spam ? "Not spam" : "Move to spam"}
        </MenuItem>
        <MenuItem
          icon={<TrashSimple size={15} />}
          onClick={onDelete}
          danger
        >
          {isTrashed ? "Delete forever" : "Delete"}
        </MenuItem>
      </div>
    </details>
  );
}

function MenuItem({
  icon,
  onClick,
  danger,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-subtle ${danger ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
    >
      <span className={`shrink-0 ${danger ? "text-red-500" : "text-text-secondary"}`}>{icon}</span>
      {children}
    </button>
  );
}
