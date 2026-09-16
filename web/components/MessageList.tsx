"use client";

type Email = {
  id: string;
  from: string;
  subject: string;
  text: string | null;
  read: boolean;
  createdAt: string;
};

function snippet(text: string | null): string {
  if (!text) return "";
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}...` : oneLine;
}

export function MessageList({
  emails,
  activeEmailId,
  onSelectEmail,
}: {
  emails: Email[];
  activeEmailId: string | null;
  onSelectEmail: (id: string) => void;
}) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        No messages yet
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {emails.map((email) => (
        <li key={email.id}>
          <button
            type="button"
            onClick={() => onSelectEmail(email.id)}
            className={`flex w-full flex-col gap-1 border-b border-black/5 px-4 py-3 text-left transition-colors dark:border-white/10 ${
              email.id === activeEmailId
                ? "bg-black/[.06] dark:bg-white/[.08]"
                : "hover:bg-black/[.03] dark:hover:bg-white/[.05]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 truncate">
                {!email.read && (
                  <span
                    aria-label="Unread"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600"
                  />
                )}
                <span
                  className={`truncate text-sm ${email.read ? "text-zinc-600 dark:text-zinc-400" : "font-semibold text-foreground"}`}
                >
                  {email.from}
                </span>
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {new Date(email.createdAt).toLocaleDateString()}
              </span>
            </div>
            <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
              {email.subject}
            </span>
            <span className="truncate text-xs text-zinc-500">
              {snippet(email.text)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
