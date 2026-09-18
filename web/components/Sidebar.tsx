"use client";

import { useState } from "react";
import {
  Archive,
  EnvelopeSimple,
  Flag,
  NotePencil,
  PaperPlaneTilt,
  PencilSimpleLine,
  Plus,
  ShieldWarning,
  Star,
  Stack,
  Tag,
  TrashSimple,
  X,
} from "@phosphor-icons/react";
import { DrawablyBadge } from "drawably/react";
import type { FolderId } from "@/lib/mail-folders";
import { DrawablyLinkButton } from "@/components/ui/DrawablyLinkButton";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Mailbox = { id: string; address: string; isDefault: boolean };
type Label = { id: string; name: string; color: string };
type Domain = { id: string; name: string; status: string };

const LABEL_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const FOLDER_NAV: Array<{
  id: FolderId;
  label: string;
  icon: typeof EnvelopeSimple;
}> = [
  { id: "inbox", label: "Inbox", icon: EnvelopeSimple },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: PaperPlaneTilt },
  { id: "drafts", label: "Drafts", icon: NotePencil },
  { id: "important", label: "Important", icon: Flag },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "spam", label: "Spam", icon: ShieldWarning },
  { id: "trash", label: "Trash", icon: TrashSimple },
  { id: "all", label: "All Mail", icon: Stack },
];

export function Sidebar({
  mailboxes,
  activeMailboxId,
  activeFolder,
  unreadCount,
  onSelectMailbox,
  onSelectFolder,
  labels,
  activeLabelId,
  onSelectLabel,
  onCreateLabel,
  onRenameLabel,
  onDeleteLabel,
  onCreateMailbox,
  onSetPrimaryMailbox,
  onDeleteMailbox,
}: {
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  activeFolder: FolderId;
  unreadCount: number;
  onSelectMailbox: (id: string) => void;
  onSelectFolder: (folder: FolderId) => void;
  labels: Label[];
  activeLabelId: string | null;
  onSelectLabel: (id: string | null) => void;
  onCreateLabel: (name: string, color: string) => void;
  onRenameLabel: (id: string, name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
  onCreateMailbox: (domainId: string, localPart: string) => Promise<{ error?: string }>;
  onSetPrimaryMailbox: (id: string) => void;
  onDeleteMailbox: (id: string) => Promise<{ error?: string }>;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border p-4">
      <DrawablyLinkButton href="/compose" className="mb-6 justify-center ">
        <PencilSimpleLine size={18} weight="bold" />
        Compose mail
      </DrawablyLinkButton>

      <nav className="flex flex-col gap-1">
        {FOLDER_NAV.map(({ id, label, icon: Icon }) => {
          const active = id === activeFolder;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectFolder(id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "text-text-secondary hover:bg-surface-subtle"
              }`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              <span className="flex-1">{label}</span>
              {id === "inbox" && unreadCount > 0 && (
                <DrawablyBadge roughness={0.3} boil={0.1} className="tabular-nums">
                  {unreadCount}
                </DrawablyBadge>
              )}
            </button>
          );
        })}
      </nav>

      <LabelsNav
        labels={labels}
        activeLabelId={activeLabelId}
        onSelectLabel={onSelectLabel}
        onCreateLabel={onCreateLabel}
        onRenameLabel={onRenameLabel}
        onDeleteLabel={onDeleteLabel}
      />

      <MailboxesNav
        mailboxes={mailboxes}
        activeMailboxId={activeMailboxId}
        onSelectMailbox={onSelectMailbox}
        onSetPrimaryMailbox={onSetPrimaryMailbox}
        onDeleteMailbox={onDeleteMailbox}
        onCreateMailbox={onCreateMailbox}
      />
    </aside>
  );
}

function MailboxesNav({
  mailboxes,
  activeMailboxId,
  onSelectMailbox,
  onSetPrimaryMailbox,
  onDeleteMailbox,
  onCreateMailbox,
}: {
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  onSelectMailbox: (id: string) => void;
  onSetPrimaryMailbox: (id: string) => void;
  onDeleteMailbox: (id: string) => Promise<{ error?: string }>;
  onCreateMailbox: (domainId: string, localPart: string) => Promise<{ error?: string }>;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirming = mailboxes.find((m) => m.id === confirmingId) ?? null;

  return (
    <div className="mt-6">
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
        Mailboxes
      </p>
      <nav className="flex flex-col gap-1">
        {mailboxes.map((mailbox) => (
          <div key={mailbox.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectMailbox(mailbox.id)}
              className={`flex flex-1 items-center gap-2 truncate rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                mailbox.id === activeMailboxId
                  ? "bg-surface-subtle font-medium text-foreground"
                  : "text-text-secondary hover:bg-surface-subtle"
              }`}
            >
              {mailbox.isDefault && (
                <Star size={12} weight="fill" className="shrink-0 text-brand-500" aria-label="Primary" />
              )}
              <span className="truncate">{mailbox.address}</span>
            </button>
            <div className="hidden shrink-0 gap-0.5 group-hover:flex">
              {!mailbox.isDefault && (
                <IconButton
                  label={`Set ${mailbox.address} as primary`}
                  onClick={() => onSetPrimaryMailbox(mailbox.id)}
                  className="h-6 w-6"
                >
                  <Star size={12} />
                </IconButton>
              )}
              {mailboxes.length > 1 && (
                <IconButton
                  label={`Delete ${mailbox.address}`}
                  tone="danger"
                  onClick={() => setConfirmingId(mailbox.id)}
                  className="h-6 w-6"
                >
                  <TrashSimple size={12} />
                </IconButton>
              )}
            </div>
          </div>
        ))}
      </nav>
      <AddMailboxForm onCreateMailbox={onCreateMailbox} />
      <ConfirmDialog
        open={confirming !== null}
        title="Delete mailbox"
        message={
          confirming
            ? `Delete ${confirming.address}? This permanently deletes all of its emails.`
            : ""
        }
        confirmLabel="Delete"
        onCancel={() => setConfirmingId(null)}
        onConfirm={async () => {
          if (confirming) await onDeleteMailbox(confirming.id);
          setConfirmingId(null);
        }}
      />
    </div>
  );
}

function AddMailboxForm({
  onCreateMailbox,
}: {
  onCreateMailbox: (domainId: string, localPart: string) => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [domainId, setDomainId] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function openDialog() {
    setOpen(true);
    if (domains) return;
    fetch("/api/domains")
      .then((res) => res.json())
      .then(({ domains: all }: { domains: Domain[] }) => {
        const verified = all.filter((d) => d.status === "verified");
        setDomains(verified);
        setDomainId(verified[0]?.id ?? "");
      });
  }

  async function submit() {
    if (!domainId || !localPart.trim()) return;
    setError(null);
    setLoading(true);
    const { error: err } = await onCreateMailbox(domainId, localPart.trim());
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setLocalPart("");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle"
      >
        <Plus size={16} />
        Add mailbox
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add mailbox">
        {domains === null ? (
          <p className="text-sm text-text-secondary">Loading domains…</p>
        ) : domains.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No verified domain yet.{" "}
            <a href="/onboarding/domain" className="text-brand-600 underline">
              Add one
            </a>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                placeholder="hello"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                autoFocus
                className="min-w-0 flex-1"
              />
              <span className="text-text-muted">@</span>
              <Select
                aria-label="Domain"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
              >
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="button"
              disabled={loading || !localPart.trim()}
              onClick={submit}
              className="w-fit"
            >
              {loading ? "Creating…" : "Create mailbox"}
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}

function LabelsNav({
  labels,
  activeLabelId,
  onSelectLabel,
  onCreateLabel,
  onRenameLabel,
  onDeleteLabel,
}: {
  labels: Label[];
  activeLabelId: string | null;
  onSelectLabel: (id: string | null) => void;
  onCreateLabel: (name: string, color: string) => void;
  onRenameLabel: (id: string, name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editing = labels.find((l) => l.id === editingId) ?? null;

  return (
    <div className="mt-6">
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
        Labels
      </p>
      <nav className="flex flex-col gap-1">
        {labels.map((label) => (
          <div key={label.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectLabel(label.id)}
              className={`flex flex-1 items-center gap-3 truncate rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                activeLabelId === label.id
                  ? "bg-surface-subtle font-medium text-foreground"
                  : "text-text-secondary hover:bg-surface-subtle"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              <span className="flex-1 truncate">{label.name}</span>
            </button>
            <div className="hidden shrink-0 gap-0.5 group-hover:flex">
              <IconButton
                label={`Rename ${label.name}`}
                onClick={() => setEditingId(label.id)}
                className="h-6 w-6"
              >
                <PencilSimpleLine size={12} />
              </IconButton>
              <IconButton
                label={`Delete ${label.name}`}
                tone="danger"
                onClick={() => onDeleteLabel(label.id)}
                className="h-6 w-6"
              >
                <X size={12} />
              </IconButton>
            </div>
          </div>
        ))}
      </nav>
      <Dialog open={editing !== null} onClose={() => setEditingId(null)} title="Rename label">
        {editing && (
          <LabelForm
            initialName={editing.name}
            initialColor={editing.color}
            onSubmit={(name, color) => {
              onRenameLabel(editing.id, name, color);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        )}
      </Dialog>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle"
      >
        <Tag size={16} />
        Create label
      </button>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Create label">
        <LabelForm
          onSubmit={(name, color) => {
            onCreateLabel(name, color);
            setCreating(false);
          }}
          submitLabel="Create"
        />
      </Dialog>
    </div>
  );
}

function LabelForm({
  initialName = "",
  initialColor = LABEL_COLORS[0],
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  initialColor?: string;
  submitLabel?: string;
  onSubmit: (name: string, color: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
    if (!onCancel) setName("");
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Label name"
        autoFocus
      />
      <div className="flex flex-wrap gap-1.5">
        {LABEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={submit} className="w-fit">
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="w-fit">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
