import type { Prisma } from "../generated/prisma/client";

export const FOLDERS = [
  { id: "inbox", label: "Inbox" },
  { id: "starred", label: "Starred" },
  { id: "important", label: "Important" },
  { id: "sent", label: "Sent" },
  { id: "archive", label: "Archive" },
  { id: "spam", label: "Spam" },
  { id: "trash", label: "Trash" },
  { id: "all", label: "All Mail" },
] as const;

export type FolderId = (typeof FOLDERS)[number]["id"];

export function isFolderId(value: string): value is FolderId {
  return FOLDERS.some((f) => f.id === value);
}

type FolderMatchable = {
  direction: string;
  archived: boolean;
  spam: boolean;
  starred: boolean;
  important: boolean;
  trashedAt: string | Date | null;
};

// Mirrors folderWhere, but evaluated in-memory — lets the client optimistically
// drop an email from the current view right after a mutation instead of
// waiting on a refetch.
export function matchesFolder(email: FolderMatchable, folder: FolderId): boolean {
  const trashed = email.trashedAt !== null;
  switch (folder) {
    case "inbox":
      return email.direction === "in" && !email.archived && !email.spam && !trashed;
    case "starred":
      return email.starred && !email.spam && !trashed;
    case "important":
      return email.important && !email.spam && !trashed;
    case "sent":
      return email.direction === "out" && !trashed;
    case "archive":
      return email.archived && !email.spam && !trashed;
    case "spam":
      return email.spam && !trashed;
    case "trash":
      return trashed;
    case "all":
      return !email.spam && !trashed;
  }
}

export function folderWhere(folder: FolderId): Prisma.EmailWhereInput {
  switch (folder) {
    case "inbox":
      return { direction: "in", archived: false, spam: false, trashedAt: null };
    case "starred":
      return { starred: true, spam: false, trashedAt: null };
    case "important":
      return { important: true, spam: false, trashedAt: null };
    case "sent":
      return { direction: "out", trashedAt: null };
    case "archive":
      return { archived: true, spam: false, trashedAt: null };
    case "spam":
      return { spam: true, trashedAt: null };
    case "trash":
      return { trashedAt: { not: null } };
    case "all":
      return { spam: false, trashedAt: null };
  }
}
