"use client";

type Mailbox = { id: string; address: string };

export function Sidebar({
  mailboxes,
  activeMailboxId,
  onSelectMailbox,
}: {
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  onSelectMailbox: (id: string) => void;
}) {
  return (
    <aside className="flex w-56 flex-col border-r border-black/10 p-4 dark:border-white/15">
      <a
        href="/compose"
        className="mb-6 rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        Compose
      </a>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Mailboxes
      </p>
      <nav className="flex flex-col gap-1">
        {mailboxes.map((mailbox) => (
          <button
            key={mailbox.id}
            type="button"
            onClick={() => onSelectMailbox(mailbox.id)}
            className={`truncate rounded-md px-3 py-2 text-left text-sm transition-colors ${
              mailbox.id === activeMailboxId
                ? "bg-black/[.06] font-medium dark:bg-white/[.08]"
                : "hover:bg-black/[.03] dark:hover:bg-white/[.05]"
            }`}
          >
            {mailbox.address}
          </button>
        ))}
      </nav>
    </aside>
  );
}
