"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import {
  Archive,
  ArrowLeft,
  ArrowUUpLeft,
  Flag,
  ShieldWarning,
  Star,
  TrashSimple,
} from "@phosphor-icons/react";

type Email = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  starred: boolean;
  important: boolean;
  archived: boolean;
  spam: boolean;
  trashedAt: string | null;
};

export function ReadingPane({
  email,
  onBack,
  onToggleStar,
  onToggleImportant,
  onArchive,
  onToggleSpam,
  onDelete,
}: {
  email: Email | null;
  onBack: () => void;
  onToggleStar: (id: string, starred: boolean) => void;
  onToggleImportant: (id: string, important: boolean) => void;
  onArchive: (id: string) => void;
  onToggleSpam: (id: string, spam: boolean) => void;
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

  const isTrashed = !!email.trashedAt;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-black/4 px-4 py-3 dark:border-white/5">
        <button
          type="button"
          aria-label="Back to list"
          onClick={onBack}
          className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-black/3 dark:hover:bg-white/5"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-1 justify-end gap-1">
          <ActionButton
            active={email.starred}
            activeClass="bg-amber-50 text-amber-500 hover:bg-amber-100 dark:bg-amber-950/20"
            label={email.starred ? "Unstar" : "Star"}
            onClick={() => onToggleStar(email.id, !email.starred)}
          >
            <Star size={16} weight={email.starred ? "fill" : "regular"} />
          </ActionButton>
          <ActionButton
            active={email.important}
            activeClass="bg-brand-50 text-brand-800 hover:bg-brand-100 dark:bg-brand-800/20"
            label={email.important ? "Mark not important" : "Mark important"}
            onClick={() => onToggleImportant(email.id, !email.important)}
          >
            <Flag size={16} weight={email.important ? "fill" : "regular"} />
          </ActionButton>
          {!isTrashed && !email.spam && (
            <ActionButton label="Archive" onClick={() => onArchive(email.id)}>
              <Archive size={16} />
            </ActionButton>
          )}
          <ActionButton
            label={email.spam ? "Not spam" : "Move to spam"}
            onClick={() => onToggleSpam(email.id, !email.spam)}
          >
            {email.spam ? <ArrowUUpLeft size={16} /> : <ShieldWarning size={16} />}
          </ActionButton>
          <ActionButton
            label={isTrashed ? "Delete forever" : "Delete"}
            onClick={() => onDelete(email.id)}
            danger
          >
            <TrashSimple size={16} />
          </ActionButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <h2 className="text-xl font-semibold text-foreground">{email.subject}</h2>
        <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          From {email.from} to {email.to.join(", ")}
        </p>
        {safeHtml ? (
          <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          <p className="whitespace-pre-wrap text-sm">{email.text}</p>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  active,
  activeClass,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  activeClass?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`rounded-full p-2 transition-colors ${
        active && activeClass
          ? activeClass
          : danger
            ? "text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            : "text-zinc-500 hover:bg-black/3 dark:hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
