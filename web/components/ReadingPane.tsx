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
import { DrawablyButton, DrawablyDivider } from "drawably/react";
import { IconButton } from "@/components/ui/IconButton";

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
      <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
        Select a message
      </div>
    );
  }

  const isTrashed = !!email.trashedAt;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-3">
        <IconButton label="Back to list" onClick={onBack}>
          <ArrowLeft size={18} />
        </IconButton>
        <div className="flex flex-1 justify-end gap-1">
          <ActionButton
            active={email.starred}
            activeStroke="#f59e0b"
            label={email.starred ? "Unstar" : "Star"}
            onClick={() => onToggleStar(email.id, !email.starred)}
          >
            <Star size={16} weight={email.starred ? "fill" : "regular"} />
          </ActionButton>
          <ActionButton
            active={email.important}
            activeStroke="var(--color-brand-700)"
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
      <DrawablyDivider roughness={0.3} boil={0.1} />
      <div className="flex-1 overflow-y-auto p-8">
        <h2 className="text-xl font-semibold text-foreground">{email.subject}</h2>
        <p className="mt-1 mb-6 text-sm text-text-secondary">
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
  return (
    <DrawablyButton
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      variant="outline"
      tone={danger ? "danger" : active ? undefined : "neutral"}
      stroke={active ? activeStroke : undefined}
      roughness={0.3}
      boil={0.1}
      className="drawably-icon-btn flex h-8 w-8 items-center justify-center"
    >
      {children}
    </DrawablyButton>
  );
}
