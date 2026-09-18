"use client";

import {
  Archive,
  EnvelopeSimple,
  Flag,
  PaperPlaneTilt,
  PencilSimpleLine,
  ShieldWarning,
  Star,
  Stack,
  TrashSimple,
} from "@phosphor-icons/react";
import { DrawablyBadge } from "drawably/react";
import type { FolderId } from "@/lib/mail-folders";
import { DrawablyLinkButton } from "@/components/ui/DrawablyLinkButton";

type Mailbox = { id: string; address: string };

const FOLDER_NAV: Array<{
  id: FolderId;
  label: string;
  icon: typeof EnvelopeSimple;
}> = [
  { id: "inbox", label: "Inbox", icon: EnvelopeSimple },
  { id: "starred", label: "Starred", icon: Star },
  { id: "important", label: "Important", icon: Flag },
  { id: "sent", label: "Sent", icon: PaperPlaneTilt },
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
}: {
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  activeFolder: FolderId;
  unreadCount: number;
  onSelectMailbox: (id: string) => void;
  onSelectFolder: (folder: FolderId) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border p-4">
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

      {mailboxes.length > 1 && (
        <>
          <p className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
            Mailboxes
          </p>
          <nav className="flex flex-col gap-1">
            {mailboxes.map((mailbox) => (
              <button
                key={mailbox.id}
                type="button"
                onClick={() => onSelectMailbox(mailbox.id)}
                className={`truncate rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  mailbox.id === activeMailboxId
                    ? "bg-surface-subtle font-medium text-foreground"
                    : "text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                {mailbox.address}
              </button>
            ))}
          </nav>
        </>
      )}
    </aside>
  );
}
