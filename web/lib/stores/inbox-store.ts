import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { matchesFolder, type FolderId } from "@/lib/mail-folders";
import { matchesSearchQuery } from "@/lib/search-query";
import { readError } from "@/lib/api-error";

export type Mailbox = { id: string; address: string; isDefault: boolean };
export type Label = { id: string; name: string; color: string };
export type Attachment = { id: string; filename: string; contentType: string; size: number | null };
export type Email = {
  id: string;
  direction: string;
  status: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  read: boolean;
  starred: boolean;
  important: boolean;
  archived: boolean;
  spam: boolean;
  trashedAt: string | null;
  createdAt: string;
  labels: Label[];
  attachments: Attachment[];
};

async function bulkUpdate(ids: string[], data: Record<string, boolean>) {
  await fetch("/api/emails", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, ...data }),
  });
}

async function bulkDeleteForever(ids: string[]) {
  await fetch("/api/emails", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export type InboxState = {
  initialized: boolean;
  mailboxes: Mailbox[];
  activeMailboxId: string;
  activeFolder: FolderId;
  activeLabelId: string | null;
  labels: Label[];
  emails: Email[];
  loading: boolean;
  activeEmailId: string | null;
  query: string;
  selectedIds: Set<string>;
  refreshing: boolean;
  lastRefreshedAt: Date | null;
  // Independent of activeFolder — the sidebar's Inbox badge must stay
  // accurate even while viewing a different folder.
  inboxUnreadCount: number;

  init: (mailboxes: Mailbox[]) => void;
  fetchFolderEmails: () => Promise<void>;
  fetchLabels: () => Promise<void>;
  refreshInboxUnreadCount: () => Promise<void>;
  selectMailbox: (id: string) => void;
  selectFolder: (folder: FolderId) => void;
  selectLabel: (id: string | null) => void;
  createLabel: (name: string, color: string) => Promise<void>;
  renameLabel: (id: string, name: string, color: string) => Promise<void>;
  deleteLabel: (id: string) => Promise<void>;
  setEmailLabels: (id: string, labelIds: string[]) => Promise<void>;
  createMailbox: (domainId: string, localPart: string) => Promise<{ error?: string }>;
  setPrimaryMailbox: (id: string) => Promise<void>;
  deleteMailbox: (id: string) => Promise<{ error?: string }>;
  refresh: () => Promise<void>;
  setQuery: (value: string) => void;
  selectEmail: (id: string) => Promise<void>;
  toggleStar: (id: string, starred: boolean) => Promise<void>;
  toggleImportant: (id: string, important: boolean) => Promise<void>;
  archive: (id: string) => Promise<void>;
  toggleSpam: (id: string, spam: boolean) => Promise<void>;
  deleteEmail: (id: string) => Promise<void>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  archiveSelected: () => Promise<void>;
  spamSelected: () => Promise<void>;
  notSpamSelected: () => Promise<void>;
  trashSelected: () => Promise<void>;
  restoreSelected: () => Promise<void>;
  deleteForeverSelected: () => Promise<void>;
  emptyTrash: () => Promise<void>;
  markAllRead: () => Promise<void>;
  closeReadingPane: () => void;
};

function folderEmailsUrl(state: InboxState) {
  const labelParam = state.activeLabelId ? `&labelId=${state.activeLabelId}` : "";
  return `/api/emails?mailboxId=${state.activeMailboxId}&folder=${state.activeFolder}${labelParam}`;
}

export function filteredEmails(state: InboxState): Email[] {
  const q = state.query.trim();
  if (!q) return state.emails;
  return state.emails.filter((e) => matchesSearchQuery(e, q));
}

export const useInboxStore = create<InboxState>((set, get) => ({
  initialized: false,
  mailboxes: [],
  activeMailboxId: "",
  activeFolder: "inbox",
  activeLabelId: null,
  labels: [],
  emails: [],
  loading: true,
  activeEmailId: null,
  query: "",
  selectedIds: new Set(),
  refreshing: false,
  lastRefreshedAt: null,
  inboxUnreadCount: 0,

  init(mailboxes) {
    if (get().initialized) return;
    set({
      initialized: true,
      mailboxes,
      activeMailboxId: mailboxes.find((m) => m.isDefault)?.id ?? mailboxes[0].id,
    });
    void get().fetchFolderEmails();
    void get().fetchLabels();
    void get().refreshInboxUnreadCount();
  },

  async fetchFolderEmails() {
    set({ loading: true });
    const res = await fetch(folderEmailsUrl(get()));
    const { emails: all } = await res.json();
    set({ emails: all, lastRefreshedAt: new Date(), loading: false });
  },

  async fetchLabels() {
    const res = await fetch("/api/labels");
    const { labels: all } = await res.json();
    set({ labels: all });
  },

  async refreshInboxUnreadCount() {
    const res = await fetch(`/api/emails?mailboxId=${get().activeMailboxId}&folder=inbox`);
    const { emails: inbox } = await res.json();
    set({ inboxUnreadCount: inbox.filter((e: Email) => !e.read).length });
  },

  selectMailbox(id) {
    set({ activeMailboxId: id, activeLabelId: null, selectedIds: new Set(), activeEmailId: null });
    void get().fetchFolderEmails();
    void get().refreshInboxUnreadCount();
  },

  selectFolder(folder) {
    set({ activeFolder: folder, selectedIds: new Set(), activeEmailId: null });
    void get().fetchFolderEmails();
  },

  selectLabel(id) {
    set((state) => ({
      activeLabelId: state.activeLabelId === id ? null : id,
      selectedIds: new Set(),
      activeEmailId: null,
    }));
    void get().fetchFolderEmails();
  },

  async createLabel(name, color) {
    await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    void get().fetchLabels();
  },

  async renameLabel(id, name, color) {
    await fetch(`/api/labels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    await get().fetchLabels();
    void get().fetchFolderEmails();
  },

  async deleteLabel(id) {
    await fetch(`/api/labels/${id}`, { method: "DELETE" });
    if (get().activeLabelId === id) set({ activeLabelId: null });
    await get().fetchLabels();
    void get().fetchFolderEmails();
  },

  async setEmailLabels(id, labelIds) {
    const res = await fetch(`/api/emails/${id}/labels`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelIds }),
    });
    const { email } = await res.json();
    set((state) => ({
      emails: state.emails.map((e) => (e.id === id ? { ...e, labels: email.labels } : e)),
    }));
  },

  async createMailbox(domainId, localPart) {
    const res = await fetch("/api/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId, localPart }),
    });
    if (!res.ok) {
      return { error: await readError(res) };
    }
    const { mailbox } = await res.json();
    set((state) => ({
      mailboxes: [
        ...state.mailboxes,
        { id: mailbox.id, address: mailbox.address, isDefault: mailbox.isDefault },
      ],
      activeMailboxId: mailbox.id,
      selectedIds: new Set(),
      activeEmailId: null,
    }));
    void get().fetchFolderEmails();
    return {};
  },

  async setPrimaryMailbox(id) {
    await fetch(`/api/mailboxes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    set((state) => ({
      mailboxes: state.mailboxes.map((m) => ({ ...m, isDefault: m.id === id })),
    }));
  },

  async deleteMailbox(id) {
    const res = await fetch(`/api/mailboxes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      return { error: await readError(res) };
    }
    const next = get().mailboxes.filter((m) => m.id !== id);
    const wasActive = get().activeMailboxId === id;
    set({
      mailboxes: next,
      ...(wasActive && {
        activeMailboxId: next.find((m) => m.isDefault)?.id ?? next[0].id,
        selectedIds: new Set(),
        activeEmailId: null,
      }),
    });
    if (wasActive) void get().fetchFolderEmails();
    return {};
  },

  async refresh() {
    set({ refreshing: true });
    const res = await fetch(folderEmailsUrl(get()));
    const { emails: all } = await res.json();
    set({ emails: all, lastRefreshedAt: new Date(), refreshing: false });
  },

  setQuery(value) {
    set({ query: value });
  },

  // Drop emails that no longer belong in the current folder after a local
  // flag mutation, instead of round-tripping a refetch for every action.
  closeReadingPane() {
    set({ activeEmailId: null });
  },

  async selectEmail(id) {
    set({ activeEmailId: id });
    const email = get().emails.find((e) => e.id === id);
    if (email?.read) return;
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    set((state) => ({
      emails: state.emails.map((e) => (e.id === id ? { ...e, read: true } : e)),
    }));
    void get().refreshInboxUnreadCount();
  },

  async toggleStar(id, starred) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });
    applyLocal(set, get, (e) => ({ ...e, starred }), new Set([id]));
  },

  async toggleImportant(id, important) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ important }),
    });
    applyLocal(set, get, (e) => ({ ...e, important }), new Set([id]));
  },

  async archive(id) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    applyLocal(set, get, (e) => ({ ...e, archived: true }), new Set([id]));
  },

  async toggleSpam(id, spam) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spam }),
    });
    applyLocal(set, get, (e) => ({ ...e, spam }), new Set([id]));
  },

  // In Trash, the row/reading-pane trash icon means "delete forever";
  // everywhere else it means "move to trash".
  async deleteEmail(id) {
    if (get().activeFolder === "trash") {
      await bulkDeleteForever([id]);
      set((state) => ({
        emails: state.emails.filter((e) => e.id !== id),
        selectedIds: withoutId(state.selectedIds, id),
        activeEmailId: state.activeEmailId === id ? null : state.activeEmailId,
      }));
      void get().refreshInboxUnreadCount();
      return;
    }
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    applyLocal(set, get, (e) => ({ ...e, trashedAt: new Date().toISOString() }), new Set([id]));
  },

  toggleSelect(id) {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    });
  },

  toggleSelectAll() {
    set((state) => {
      const visible = filteredEmails(state);
      return {
        selectedIds:
          state.selectedIds.size === visible.length
            ? new Set()
            : new Set(visible.map((e) => e.id)),
      };
    });
  },

  async archiveSelected() {
    const ids = Array.from(get().selectedIds);
    await bulkUpdate(ids, { archived: true });
    applyLocal(set, get, (e) => ({ ...e, archived: true }), new Set(ids));
  },

  async spamSelected() {
    const ids = Array.from(get().selectedIds);
    await bulkUpdate(ids, { spam: true });
    applyLocal(set, get, (e) => ({ ...e, spam: true }), new Set(ids));
  },

  async notSpamSelected() {
    const ids = Array.from(get().selectedIds);
    await bulkUpdate(ids, { spam: false });
    applyLocal(set, get, (e) => ({ ...e, spam: false }), new Set(ids));
  },

  async trashSelected() {
    const ids = Array.from(get().selectedIds);
    await fetch("/api/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, trashed: true }),
    });
    applyLocal(set, get, (e) => ({ ...e, trashedAt: new Date().toISOString() }), new Set(ids));
  },

  async restoreSelected() {
    const ids = Array.from(get().selectedIds);
    await fetch("/api/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, trashed: false }),
    });
    applyLocal(set, get, (e) => ({ ...e, trashedAt: null }), new Set(ids));
  },

  async deleteForeverSelected() {
    const ids = Array.from(get().selectedIds);
    await bulkDeleteForever(ids);
    set((state) => ({
      emails: state.emails.filter((e) => !ids.includes(e.id)),
      selectedIds: new Set(),
      activeEmailId: state.activeEmailId && ids.includes(state.activeEmailId) ? null : state.activeEmailId,
    }));
    void get().refreshInboxUnreadCount();
  },

  async emptyTrash() {
    const ids = get().emails.map((e) => e.id);
    if (ids.length === 0) return;
    await bulkDeleteForever(ids);
    set({ emails: [], selectedIds: new Set(), activeEmailId: null });
  },

  async markAllRead() {
    const unread = filteredEmails(get()).filter((e) => !e.read).map((e) => e.id);
    if (unread.length === 0) return;
    await bulkUpdate(unread, { read: true });
    set((state) => ({
      emails: state.emails.map((e) => (unread.includes(e.id) ? { ...e, read: true } : e)),
    }));
    void get().refreshInboxUnreadCount();
  },
}));

function withoutId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

function applyLocal(
  set: (partial: Partial<InboxState> | ((state: InboxState) => Partial<InboxState>)) => void,
  get: () => InboxState,
  updater: (email: Email) => Email,
  ids: Set<string>
) {
  set((state) => ({
    emails: state.emails
      .map((e) => (ids.has(e.id) ? updater(e) : e))
      .filter((e) => !ids.has(e.id) || matchesFolder(e, state.activeFolder)),
    selectedIds: new Set([...state.selectedIds].filter((id) => !ids.has(id))),
    activeEmailId: state.activeEmailId && ids.has(state.activeEmailId) ? null : state.activeEmailId,
  }));
  void get().refreshInboxUnreadCount();
}

// Selector hooks for derived values — kept out of state itself.
export function useFilteredEmails(): Email[] {
  return useInboxStore(useShallow(filteredEmails));
}

export function useFolderUnreadCount(): number {
  return useInboxStore((state) => state.emails.filter((e) => !e.read).length);
}

export function useActiveEmail(): Email | null {
  return useInboxStore((state) => state.emails.find((e) => e.id === state.activeEmailId) ?? null);
}
