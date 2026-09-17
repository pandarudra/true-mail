"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { Star, TrashSimple } from "@phosphor-icons/react";

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
            aria-label={email.starred ? "Unstar" : "Star"}
            onClick={() => onToggleStar(email.id, !email.starred)}
            className={`rounded-lg border p-2 transition-colors ${
              email.starred
                ? "border-amber-200 bg-amber-50 text-amber-500 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20"
                : "border-black/10 text-zinc-500 hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.05]"
            }`}
          >
            <Star size={16} weight={email.starred ? "fill" : "regular"} />
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={() => onDelete(email.id)}
            className="rounded-lg border border-black/10 p-2 text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:hover:bg-red-950/30"
          >
            <TrashSimple size={16} />
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
