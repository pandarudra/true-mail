"use client";

import { EnvelopeSimple, PencilSimpleLine } from "@phosphor-icons/react";

type Mailbox = { id: string; address: string };
type User = { name: string; email: string };

function initial(user: User): string {
  return (user.name || user.email).charAt(0).toUpperCase();
}

export function Sidebar({
  user,
  mailboxes,
  activeMailboxId,
  unreadCount,
  onSelectMailbox,
}: {
  user: User;
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  unreadCount: number;
  onSelectMailbox: (id: string) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="mb-6 flex items-center gap-2 px-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
          T
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">
          TrueMail
        </span>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-white/[.04]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {initial(user)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {user.name || user.email}
          </p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
        </div>
      </div>

      <a
        href="/compose"
        className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-[0.98]"
      >
        <PencilSimpleLine size={18} weight="bold" />
        Compose mail
      </a>

      <div className="flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
        <EnvelopeSimple size={18} weight="fill" />
        <span className="flex-1">Inbox</span>
        {unreadCount > 0 && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </div>

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
                className={`truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  mailbox.id === activeMailboxId
                    ? "bg-black/[.06] font-medium text-foreground dark:bg-white/[.08]"
                    : "text-zinc-600 hover:bg-black/[.03] dark:text-zinc-400 dark:hover:bg-white/[.05]"
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
