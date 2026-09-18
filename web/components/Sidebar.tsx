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
import type { FolderId } from "@/lib/mail-folders";

type Mailbox = { id: string; address: string };

const FOLDER_NAV: Array<{ id: FolderId; label: string; icon: typeof EnvelopeSimple }> = [
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
    <aside className="flex w-64 shrink-0 flex-col border-r border-black/4 p-4 dark:border-white/5">
      <a
        href="/compose"
        className="mb-6 flex items-center justify-center gap-2 rounded-full bg-brand-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-800/20 transition-colors hover:bg-brand-700 active:scale-[0.98]"
      >
        <PencilSimpleLine size={18} weight="bold" />
        Compose mail
      </a>

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
                  : "text-zinc-600 hover:bg-black/3 dark:text-zinc-400 dark:hover:bg-white/5"
              }`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              <span className="flex-1">{label}</span>
              {id === "inbox" && unreadCount > 0 && (
                <span className="rounded-full bg-brand-800 px-2 py-0.5 text-xs font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {mailboxes.length > 1 && (
        <>
          <p className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
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
                    ? "bg-black/6 font-medium text-foreground dark:bg-white/8"
                    : "text-zinc-600 hover:bg-black/3 dark:text-zinc-400 dark:hover:bg-white/5"
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
