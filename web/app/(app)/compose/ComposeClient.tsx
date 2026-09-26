"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PaperPlaneTilt, Paperclip, X } from "@phosphor-icons/react";
import { CldUploadWidget } from "next-cloudinary";
import { DrawablyCard, DrawablyDivider, DrawablyTextarea } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { useSmartBack } from "@/lib/use-smart-back";
import type { ReplyMode } from "@/lib/reply";
import {
  useComposeStore,
  type ClientAttachment,
  type InitialDraft,
  type Mailbox,
  type Prefill,
} from "@/lib/stores/compose-store";

const HEADING: Record<ReplyMode, string> = {
  reply: "Reply",
  replyAll: "Reply all",
  forward: "Forward",
};

const AUTOSAVE_DELAY_MS = 1500;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

interface CloudinaryUploadInfo {
  public_id: string;
  secure_url: string;
  original_filename?: string;
  format?: string;
  resource_type: string;
  bytes: number;
}

function isUploadInfo(info: unknown): info is CloudinaryUploadInfo {
  return (
    typeof info === "object" &&
    info !== null &&
    "public_id" in info &&
    typeof (info as CloudinaryUploadInfo).public_id === "string"
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComposeClient({
  sessionKey,
  mailboxes,
  initialMailboxId,
  prefill,
  initialDraft,
}: {
  sessionKey: string;
  mailboxes: Mailbox[];
  initialMailboxId?: string;
  prefill?: Prefill;
  initialDraft?: InitialDraft;
}) {
  const router = useRouter();
  const goBack = useSmartBack();

  // Reset the store for this specific compose session (new/reply/draft) —
  // done synchronously during render, keyed off `sessionKey`, so switching
  // from replying-to-A to replying-to-B never flashes A's content. Safe
  // because ComposeClient only ever has one instance mounted at a time.
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (lastKey !== sessionKey) {
    useComposeStore
      .getState()
      .resetForSession(sessionKey, { mailboxes, initialMailboxId, prefill, initialDraft });

    // AI Reply hands off its generated draft via sessionStorage (set right
    // before navigating here) instead of a URL param, since a draft can be
    // arbitrarily long. Prepend it above the quoted-original text that
    // resetForSession just populated. Guarded for SSR — this component's
    // first render pass happens on the server, where sessionStorage doesn't
    // exist.
    if (typeof window !== "undefined") {
      const aiDraft = sessionStorage.getItem("truemail:ai-draft");
      if (aiDraft) {
        sessionStorage.removeItem("truemail:ai-draft");
        useComposeStore.getState().setText(`${aiDraft}\n\n${useComposeStore.getState().text}`);
      }
    }

    setLastKey(sessionKey);
  }

  const mailboxId = useComposeStore((s) => s.mailboxId);
  const to = useComposeStore((s) => s.to);
  const cc = useComposeStore((s) => s.cc);
  const subject = useComposeStore((s) => s.subject);
  const text = useComposeStore((s) => s.text);
  const attachments = useComposeStore((s) => s.attachments);
  const prefillMode = useComposeStore((s) => s.prefillMode);
  const error = useComposeStore((s) => s.error);
  const sending = useComposeStore((s) => s.sending);
  const discarding = useComposeStore((s) => s.discarding);
  const saveStatus = useComposeStore((s) => s.saveStatus);
  const setMailboxId = useComposeStore((s) => s.setMailboxId);
  const setTo = useComposeStore((s) => s.setTo);
  const setCc = useComposeStore((s) => s.setCc);
  const setSubject = useComposeStore((s) => s.setSubject);
  const setText = useComposeStore((s) => s.setText);
  const addAttachment = useComposeStore((s) => s.addAttachment);
  const removeAttachment = useComposeStore((s) => s.removeAttachment);

  const skipNextAutosave = useRef(true);

  // Debounced autosave: 1.5s after the user stops typing, create the draft
  // (first edit) or patch it (subsequent edits). Skips the render that
  // happens on mount so opening a reply/draft doesn't immediately re-save it.
  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (!to.trim() && !cc.trim() && !subject.trim() && !text.trim() && attachments.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      const newDraftId = await useComposeStore.getState().autosave();
      if (newDraftId) {
        router.replace(`/compose?draft=${newDraftId}`, { scroll: false });
      }
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, subject, text, mailboxId, attachments]);

  // Session key changes (a fresh reply/draft/new compose) shouldn't
  // immediately autosave either.
  useEffect(() => {
    skipNextAutosave.current = true;
  }, [sessionKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await useComposeStore.getState().send();
    if (ok) router.push("/inbox");
  }

  async function handleDiscard() {
    await useComposeStore.getState().discard();
    router.push("/inbox");
  }

  return (
    <main className="flex min-h-screen justify-center bg-surface-subtle px-4 py-12">
      <DrawablyCard roughness={0.3} boil={0.1} className="w-full max-w-2xl bg-surface p-8">
        <button
          type="button"
          onClick={goBack}
          className="mb-6 flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to inbox
        </button>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-foreground">
              {prefillMode ? HEADING[prefillMode] : "New message"}
            </h1>
            {saveStatus !== "idle" && (
              <span className="text-xs text-text-secondary">
                {saveStatus === "saving" ? "Saving…" : "Saved"}
              </span>
            )}
          </div>
          <div>
            <label className="flex items-center gap-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-text-secondary">From</span>
              <select
                value={mailboxId}
                onChange={(e) => setMailboxId(e.target.value)}
                className="flex-1 bg-transparent text-foreground outline-none"
              >
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.address}
                  </option>
                ))}
              </select>
            </label>
            <DrawablyDivider roughness={0.3} boil={0.1} />
          </div>
          <div>
            <label className="flex items-center gap-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-text-secondary">To</span>
              <input
                type="text"
                placeholder="someone@example.com, another@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                className="flex-1 bg-transparent text-foreground outline-none placeholder:text-text-muted"
              />
            </label>
            <DrawablyDivider roughness={0.3} boil={0.1} />
          </div>
          <div>
            <label className="flex items-center gap-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-text-secondary">Cc</span>
              <input
                type="text"
                placeholder="cc@example.com (optional)"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 bg-transparent text-foreground outline-none placeholder:text-text-muted"
              />
            </label>
            <DrawablyDivider roughness={0.3} boil={0.1} />
          </div>
          <div>
            <label className="flex items-center gap-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-text-secondary">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="flex-1 bg-transparent text-foreground outline-none"
              />
            </label>
            <DrawablyDivider roughness={0.3} boil={0.1} />
          </div>
          <DrawablyTextarea
            roughness={0.3}
            boil={0.1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={12}
            placeholder="Write your message..."
            className="text-sm text-foreground"
          />
          {attachments.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {attachments.map((a: ClientAttachment) => (
                <li
                  key={a.publicId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"
                >
                  <span className="truncate text-foreground">
                    {a.filename}{" "}
                    <span className="text-text-secondary">({formatBytes(a.size)})</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.filename}`}
                    onClick={() => removeAttachment(a.publicId)}
                    className="shrink-0 text-text-secondary hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <CldUploadWidget
            signatureEndpoint="/api/sign-cloudinary-params"
            options={{ sources: ["local"], multiple: true, maxFileSize: MAX_ATTACHMENT_BYTES }}
            onSuccess={(result) => {
              if (!isUploadInfo(result?.info)) return;
              const info = result.info;
              addAttachment({
                publicId: info.public_id,
                url: info.secure_url,
                filename: info.original_filename ?? info.public_id,
                contentType: info.format ? `${info.resource_type}/${info.format}` : info.resource_type,
                size: info.bytes,
              });
            }}
          >
            {({ open }) => (
              <button
                type="button"
                onClick={() => open()}
                className="flex w-fit items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
              >
                <Paperclip size={16} />
                Attach files
              </button>
            )}
          </CldUploadWidget>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={sending || !mailboxId} className="w-fit">
              <PaperPlaneTilt size={16} weight="bold" />
              {sending ? "Sending..." : "Send"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={discarding}
              onClick={handleDiscard}
              className="w-fit"
            >
              {discarding ? "Discarding..." : "Discard"}
            </Button>
          </div>
        </form>
      </DrawablyCard>
    </main>
  );
}
