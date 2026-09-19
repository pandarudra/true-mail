import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { requireMailboxes } from "@/lib/require-mailboxes";
import { buildReplyPrefill, isReplyMode, type ReplyMode } from "@/lib/reply";
import { ComposeClient } from "./ComposeClient";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ replyTo?: string; mode?: string; draft?: string }>;
}) {
  const userId = (await getUserId(await headers()))!;
  const mailboxes = await requireMailboxes(userId);
  const { replyTo, mode, draft } = await searchParams;

  type ClientAttachment = {
    publicId: string;
    url: string;
    filename: string;
    contentType: string;
    size: number;
  };

  let initialMailboxId: string | undefined;
  let prefill: (ReturnType<typeof buildReplyPrefill> & { mode: ReplyMode }) | undefined;
  let initialDraft:
    | {
        id: string;
        to: string[];
        cc: string[];
        subject: string;
        text: string;
        attachments: ClientAttachment[];
      }
    | undefined;

  if (draft) {
    const source = await prisma.email.findFirst({
      where: { id: draft, mailbox: { userId }, status: "draft" },
      include: { attachments: true },
    });
    if (source) {
      initialMailboxId = source.mailboxId;
      initialDraft = {
        id: source.id,
        to: source.to,
        cc: source.cc,
        subject: source.subject,
        text: source.text ?? "",
        attachments: source.attachments.map((a) => ({
          publicId: a.cloudinaryPublicId ?? "",
          url: a.cloudinaryUrl ?? "",
          filename: a.filename,
          contentType: a.contentType,
          size: a.size ?? 0,
        })),
      };
    }
  } else if (replyTo && isReplyMode(mode)) {
    const source = await prisma.email.findFirst({
      where: { id: replyTo, mailbox: { userId } },
      include: { mailbox: true },
    });
    if (source) {
      initialMailboxId = source.mailboxId;
      prefill = { ...buildReplyPrefill(source, mode, source.mailbox.address), mode };
    }
  }

  initialMailboxId ??= mailboxes.find((m) => m.isDefault)?.id;

  // Identifies this specific compose session, so the store knows when to
  // reset instead of carrying over a previous session's text/attachments.
  const sessionKey = draft ?? (replyTo ? `${replyTo}-${mode}` : "new");

  return (
    <ComposeClient
      sessionKey={sessionKey}
      mailboxes={mailboxes.map((m) => ({ id: m.id, address: m.address }))}
      initialMailboxId={initialMailboxId}
      prefill={prefill}
      initialDraft={initialDraft}
    />
  );
}
