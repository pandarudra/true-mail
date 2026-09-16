"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

type Email = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  starred: boolean;
};

export function ReadingPane({
  email,
  onToggleStar,
  onDelete,
}: {
  email: Email | null;
  onToggleStar: (id: string, starred: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const safeHtml = useMemo(
    () => (email?.html ? DOMPurify.sanitize(email.html) : null),
    [email]
  );

  if (!email) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Select a message
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {email.subject}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            From {email.from} to {email.to.join(", ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onToggleStar(email.id, !email.starred)}
            className="rounded-md border border-black/10 px-3 py-1 text-sm transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
          >
            {email.starred ? "Unstar" : "Star"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(email.id)}
            className="rounded-md border border-black/10 px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-white/15 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </div>
      {safeHtml ? (
        <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : (
        <p className="whitespace-pre-wrap text-sm">{email.text}</p>
      )}
    </div>
  );
}
