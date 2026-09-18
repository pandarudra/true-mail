"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PaperPlaneTilt, Paperclip, X } from "@phosphor-icons/react";
import { CldUploadWidget } from "next-cloudinary";
import { DrawablyCard, DrawablyDivider, DrawablyTextarea } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { readError } from "@/lib/api-error";
import type { ReplyMode } from "@/lib/reply";

type Mailbox = { id: string; address: string };
type Prefill = { to: string[]; cc: string[]; subject: string; text: string; mode: ReplyMode };
type ClientAttachment = {
  publicId: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
};
type InitialDraft = {
  id: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachments: ClientAttachment[];
};

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

function addressList(addrs: string[]): string {
  return addrs.join(", ");
}

function parseAddresses(value: string): string[] {
  return value.split(",").map((addr) => addr.trim()).filter(Boolean);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComposeClient({
  mailboxes,
  initialMailboxId,
  prefill,
  initialDraft,
}: {
  mailboxes: Mailbox[];
  initialMailboxId?: string;
  prefill?: Prefill;
  initialDraft?: InitialDraft;
}) {
  const router = useRouter();
  const [mailboxId, setMailboxId] = useState(initialMailboxId ?? mailboxes[0]?.id ?? "");
  const [to, setTo] = useState(addressList(initialDraft?.to ?? prefill?.to ?? []));
  const [cc, setCc] = useState(addressList(initialDraft?.cc ?? prefill?.cc ?? []));
  const [subject, setSubject] = useState(initialDraft?.subject ?? prefill?.subject ?? "");
  const [text, setText] = useState(initialDraft?.text ?? prefill?.text ?? "");
  const [attachments, setAttachments] = useState<ClientAttachment[]>(
    initialDraft?.attachments ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const draftIdRef = useRef(initialDraft?.id ?? null);
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
      setSaveStatus("saving");
      const payload = {
        mailboxId,
        to: parseAddresses(to),
        cc: parseAddresses(cc),
        subject,
        text,
        attachments,
      };
      if (draftIdRef.current) {
        await fetch(`/api/emails/${draftIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const { email } = await res.json();
          draftIdRef.current = email.id;
          router.replace(`/compose?draft=${email.id}`, { scroll: false });
        }
      }
      setSaveStatus("saved");
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, subject, text, mailboxId, attachments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const res = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId,
        to: parseAddresses(to),
        cc: parseAddresses(cc),
        subject,
        text,
        attachments,
      }),
    });
    setSending(false);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    if (draftIdRef.current) {
      await fetch(`/api/emails/${draftIdRef.current}`, { method: "DELETE" });
    }
    router.push("/inbox");
  }

  async function handleDiscard() {
    setDiscarding(true);
    if (draftIdRef.current) {
      await fetch(`/api/emails/${draftIdRef.current}`, { method: "DELETE" });
    }
    router.push("/inbox");
  }

  return (
    <main className="flex min-h-screen justify-center bg-surface-subtle px-4 py-12">
      <DrawablyCard roughness={0.3} boil={0.1} className="w-full max-w-2xl bg-surface p-8">
        <button
          type="button"
          onClick={() => router.push("/inbox")}
          className="mb-6 flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to inbox
        </button>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-foreground">
              {prefill ? HEADING[prefill.mode] : "New message"}
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
              {attachments.map((a) => (
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
                    onClick={() =>
                      setAttachments((prev) => prev.filter((x) => x.publicId !== a.publicId))
                    }
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
              setAttachments((prev) => [
                ...prev,
                {
                  publicId: info.public_id,
                  url: info.secure_url,
                  filename: info.original_filename ?? info.public_id,
                  contentType: info.format ? `${info.resource_type}/${info.format}` : info.resource_type,
                  size: info.bytes,
                },
              ]);
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
