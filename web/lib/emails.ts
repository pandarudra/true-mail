import { prisma } from "@/lib/db";
import { emailBodyText } from "@/lib/email-text";
import { folderWhere, isFolderId } from "@/lib/mail-folders";

export type EmailSearchResult = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  createdAt: Date;
};

const SEARCH_SELECT = { id: true, from: true, subject: true, text: true, html: true, createdAt: true } as const;

// Across all of the user's mailboxes, not one — a real question ("find the
// email where Rahul sent the API credentials") cuts across folders and
// mailboxes, same reasoning app/api/ai/ask's route already uses.
export async function searchEmailsForUser(
  userId: string,
  opts: { query?: string; folder?: string; limit?: number } = {}
): Promise<EmailSearchResult[]> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 20);
  // Every word must appear somewhere (subject, sender, or body) — the AI
  // passes queries like "Priya launch" whose words never occur as one
  // contiguous phrase, and an exact-phrase match finds nothing.
  const words = opts.query?.trim().split(/\s+/).filter(Boolean) ?? [];
  const emails = await prisma.email.findMany({
    where: {
      mailbox: { userId },
      trashedAt: null,
      ...(opts.folder && isFolderId(opts.folder) ? folderWhere(opts.folder) : {}),
      AND: words.map((word) => ({
        OR: [
          { subject: { contains: word, mode: "insensitive" as const } },
          { from: { contains: word, mode: "insensitive" as const } },
          { text: { contains: word, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: SEARCH_SELECT,
  });
  return emails.map((e) => ({
    id: e.id,
    from: e.from,
    subject: e.subject,
    snippet: emailBodyText(e).slice(0, 200),
    createdAt: e.createdAt,
  }));
}

export async function loadOwnedEmail(id: string, userId: string) {
  return prisma.email.findFirst({ where: { id, mailbox: { userId } } });
}
