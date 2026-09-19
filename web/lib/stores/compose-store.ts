import { create } from "zustand";
import type { ReplyMode } from "@/lib/reply";
import { readError } from "@/lib/api-error";

export type Mailbox = { id: string; address: string };
export type Prefill = { to: string[]; cc: string[]; subject: string; text: string; mode: ReplyMode };
export type ClientAttachment = {
  publicId: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
};
export type InitialDraft = {
  id: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachments: ClientAttachment[];
};

function addressList(addrs: string[]): string {
  return addrs.join(", ");
}

export function parseAddresses(value: string): string[] {
  return value.split(",").map((addr) => addr.trim()).filter(Boolean);
}

type ComposeState = {
  sessionKey: string | null;
  mailboxId: string;
  to: string;
  cc: string;
  subject: string;
  text: string;
  attachments: ClientAttachment[];
  draftId: string | null;
  prefillMode: ReplyMode | null;
  error: string | null;
  sending: boolean;
  discarding: boolean;
  saveStatus: "idle" | "saving" | "saved";

  resetForSession: (
    sessionKey: string,
    args: { mailboxes: Mailbox[]; initialMailboxId?: string; prefill?: Prefill; initialDraft?: InitialDraft }
  ) => void;
  setMailboxId: (id: string) => void;
  setTo: (value: string) => void;
  setCc: (value: string) => void;
  setSubject: (value: string) => void;
  setText: (value: string) => void;
  addAttachment: (attachment: ClientAttachment) => void;
  removeAttachment: (publicId: string) => void;
  // Returns the newly created draft id the first time a draft is created
  // (so the caller can sync it into the URL), or null on subsequent saves.
  autosave: () => Promise<string | null>;
  send: () => Promise<boolean>;
  discard: () => Promise<void>;
};

export const useComposeStore = create<ComposeState>((set, get) => ({
  sessionKey: null,
  mailboxId: "",
  to: "",
  cc: "",
  subject: "",
  text: "",
  attachments: [],
  draftId: null,
  prefillMode: null,
  error: null,
  sending: false,
  discarding: false,
  saveStatus: "idle",

  resetForSession(sessionKey, { mailboxes, initialMailboxId, prefill, initialDraft }) {
    set({
      sessionKey,
      mailboxId: initialMailboxId ?? mailboxes[0]?.id ?? "",
      to: addressList(initialDraft?.to ?? prefill?.to ?? []),
      cc: addressList(initialDraft?.cc ?? prefill?.cc ?? []),
      subject: initialDraft?.subject ?? prefill?.subject ?? "",
      text: initialDraft?.text ?? prefill?.text ?? "",
      attachments: initialDraft?.attachments ?? [],
      draftId: initialDraft?.id ?? null,
      prefillMode: prefill?.mode ?? null,
      error: null,
      sending: false,
      discarding: false,
      saveStatus: "idle",
    });
  },

  setMailboxId(id) {
    set({ mailboxId: id });
  },
  setTo(value) {
    set({ to: value });
  },
  setCc(value) {
    set({ cc: value });
  },
  setSubject(value) {
    set({ subject: value });
  },
  setText(value) {
    set({ text: value });
  },
  addAttachment(attachment) {
    set((state) => ({ attachments: [...state.attachments, attachment] }));
  },
  removeAttachment(publicId) {
    set((state) => ({
      attachments: state.attachments.filter((a) => a.publicId !== publicId),
    }));
  },

  async autosave() {
    const { mailboxId, to, cc, subject, text, attachments, draftId } = get();
    set({ saveStatus: "saving" });
    const payload = {
      mailboxId,
      to: parseAddresses(to),
      cc: parseAddresses(cc),
      subject,
      text,
      attachments,
    };
    if (draftId) {
      await fetch(`/api/emails/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      set({ saveStatus: "saved" });
      return null;
    }
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    set({ saveStatus: "saved" });
    if (!res.ok) return null;
    const { email } = await res.json();
    set({ draftId: email.id });
    return email.id as string;
  },

  async send() {
    const { mailboxId, to, cc, subject, text, attachments, draftId } = get();
    set({ error: null, sending: true });
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
    set({ sending: false });
    if (!res.ok) {
      set({ error: await readError(res) });
      return false;
    }
    if (draftId) {
      await fetch(`/api/emails/${draftId}`, { method: "DELETE" });
    }
    return true;
  },

  async discard() {
    set({ discarding: true });
    const { draftId } = get();
    if (draftId) {
      await fetch(`/api/emails/${draftId}`, { method: "DELETE" });
    }
  },
}));
