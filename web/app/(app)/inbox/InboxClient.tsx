"use client";

import { useMemo, useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { InboxToolbar } from "@/components/InboxToolbar";
import { MessageList } from "@/components/MessageList";
import { ReadingPane } from "@/components/ReadingPane";
import { matchesFolder, type FolderId } from "@/lib/mail-folders";

type Mailbox = { id: string; address: string };
type Email = {
  id: string;
  direction: string;
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

export function InboxClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const { data: session } = authClient.useSession();
  const [mailboxes] = useState<Mailbox[]>(initialMailboxes);
  const [activeMailboxId, setActiveMailboxId] = useState<string>(initialMailboxes[0].id);
  const [activeFolder, setActiveFolder] = useState<FolderId>("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  // Independent of activeFolder — the sidebar's Inbox badge must stay
  // accurate even while viewing a different folder.
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  async function fetchFolderEmails() {
    const res = await fetch(`/api/emails?mailboxId=${activeMailboxId}&folder=${activeFolder}`);
    const { emails: all } = await res.json();
    setEmails(all);
    setLastRefreshedAt(new Date());
  }

  useEffect(() => {
    fetch(`/api/emails?mailboxId=${activeMailboxId}&folder=${activeFolder}`)
      .then((res) => res.json())
      .then(({ emails: all }: { emails: Email[] }) => {
        setEmails(all);
        setLastRefreshedAt(new Date());
      });
  }, [activeMailboxId, activeFolder]);

  async function refreshInboxUnreadCount() {
    const res = await fetch(`/api/emails?mailboxId=${activeMailboxId}&folder=inbox`);
    const { emails: inbox } = await res.json();
    setInboxUnreadCount(inbox.filter((e: Email) => !e.read).length);
  }

  useEffect(() => {
    fetch(`/api/emails?mailboxId=${activeMailboxId}&folder=inbox`)
      .then((res) => res.json())
      .then(({ emails: inbox }: { emails: Email[] }) =>
        setInboxUnreadCount(inbox.filter((e) => !e.read).length)
      );
  }, [activeMailboxId]);

  // New mail (especially inbound, via webhook) doesn't push to the client —
  // poll in the background so it shows up without a manual refresh click.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFolderEmails();
      refreshInboxUnreadCount();
    }, 20_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMailboxId, activeFolder]);

  function resetSelection() {
    setSelectedIds(new Set());
    setActiveEmailId(null);
  }

  function handleSelectMailbox(id: string) {
    setActiveMailboxId(id);
    resetSelection();
  }

  function handleSelectFolder(folder: FolderId) {
    setActiveFolder(folder);
    resetSelection();
  }

  async function handleRefresh() {
    setRefreshing(true);
    const res = await fetch(`/api/emails?mailboxId=${activeMailboxId}&folder=${activeFolder}`);
    const { emails: all } = await res.json();
    setEmails(all);
    setLastRefreshedAt(new Date());
    setRefreshing(false);
  }

  const filteredEmails = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter(
      (e) =>
        e.from.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.text?.toLowerCase().includes(q)
    );
  }, [emails, query]);

  const folderUnreadCount = emails.filter((e) => !e.read).length;

  // Drop emails that no longer belong in the current folder after a local
  // flag mutation, instead of round-tripping a refetch for every action.
  function applyLocal(updater: (email: Email) => Email, ids: Set<string>) {
    setEmails((prev) =>
      prev
        .map((e) => (ids.has(e.id) ? updater(e) : e))
        .filter((e) => !ids.has(e.id) || matchesFolder(e, activeFolder))
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setActiveEmailId((prev) => (prev && ids.has(prev) ? null : prev));
    void refreshInboxUnreadCount();
  }

  async function handleSelectEmail(id: string) {
    setActiveEmailId(id);
    const email = emails.find((e) => e.id === id);
    if (email?.read) return;
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, read: true } : e)));
    void refreshInboxUnreadCount();
  }

  async function handleToggleStar(id: string, starred: boolean) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });
    applyLocal((e) => ({ ...e, starred }), new Set([id]));
  }

  async function handleToggleImportant(id: string, important: boolean) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ important }),
    });
    applyLocal((e) => ({ ...e, important }), new Set([id]));
  }

  async function handleArchive(id: string) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    applyLocal((e) => ({ ...e, archived: true }), new Set([id]));
  }

  async function handleToggleSpam(id: string, spam: boolean) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spam }),
    });
    applyLocal((e) => ({ ...e, spam }), new Set([id]));
  }

  // In Trash, the row/reading-pane trash icon means "delete forever";
  // everywhere else it means "move to trash".
  async function handleDelete(id: string) {
    if (activeFolder === "trash") {
      await bulkDeleteForever([id]);
      setEmails((prev) => prev.filter((e) => e.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setActiveEmailId((prev) => (prev === id ? null : prev));
      void refreshInboxUnreadCount();
      return;
    }
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    applyLocal((e) => ({ ...e, trashedAt: new Date().toISOString() }), new Set([id]));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filteredEmails.length
        ? new Set()
        : new Set(filteredEmails.map((e) => e.id))
    );
  }

  async function handleArchiveSelected() {
    const ids = Array.from(selectedIds);
    await bulkUpdate(ids, { archived: true });
    applyLocal((e) => ({ ...e, archived: true }), new Set(ids));
  }

  async function handleSpamSelected() {
    const ids = Array.from(selectedIds);
    await bulkUpdate(ids, { spam: true });
    applyLocal((e) => ({ ...e, spam: true }), new Set(ids));
  }

  async function handleNotSpamSelected() {
    const ids = Array.from(selectedIds);
    await bulkUpdate(ids, { spam: false });
    applyLocal((e) => ({ ...e, spam: false }), new Set(ids));
  }

  async function handleTrashSelected() {
    const ids = Array.from(selectedIds);
    await fetch("/api/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, trashed: true }),
    });
    applyLocal((e) => ({ ...e, trashedAt: new Date().toISOString() }), new Set(ids));
  }

  async function handleRestoreSelected() {
    const ids = Array.from(selectedIds);
    await fetch("/api/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, trashed: false }),
    });
    applyLocal((e) => ({ ...e, trashedAt: null }), new Set(ids));
  }

  async function handleDeleteForeverSelected() {
    const ids = Array.from(selectedIds);
    await bulkDeleteForever(ids);
    setEmails((prev) => prev.filter((e) => !ids.includes(e.id)));
    setSelectedIds(new Set());
    setActiveEmailId((prev) => (prev && ids.includes(prev) ? null : prev));
    void refreshInboxUnreadCount();
  }

  async function handleEmptyTrash() {
    const ids = emails.map((e) => e.id);
    if (ids.length === 0) return;
    await bulkDeleteForever(ids);
    setEmails([]);
    setSelectedIds(new Set());
    setActiveEmailId(null);
  }

  async function handleMarkAllRead() {
    const unread = filteredEmails.filter((e) => !e.read).map((e) => e.id);
    if (unread.length === 0) return;
    await bulkUpdate(unread, { read: true });
    setEmails((prev) => prev.map((e) => (unread.includes(e.id) ? { ...e, read: true } : e)));
    void refreshInboxUnreadCount();
  }

  const activeEmail = emails.find((e) => e.id === activeEmailId) ?? null;

  return (
    <div className="flex h-screen flex-col bg-surface-subtle">
      <TopBar
        user={{
          name: session?.user.name ?? "",
          email: session?.user.email ?? "",
        }}
        query={query}
        onQueryChange={setQuery}
      />
      <div className="flex flex-1 overflow-hidden bg-surface">
        <Sidebar
          mailboxes={mailboxes}
          activeMailboxId={activeMailboxId}
          activeFolder={activeFolder}
          unreadCount={inboxUnreadCount}
          onSelectMailbox={handleSelectMailbox}
          onSelectFolder={handleSelectFolder}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeEmail ? (
            <ReadingPane
              email={activeEmail}
              onBack={() => setActiveEmailId(null)}
              onToggleStar={handleToggleStar}
              onToggleImportant={handleToggleImportant}
              onArchive={handleArchive}
              onToggleSpam={handleToggleSpam}
              onDelete={handleDelete}
            />
          ) : (
            <>
              <InboxToolbar
                folder={activeFolder}
                totalCount={filteredEmails.length}
                unreadCount={folderUnreadCount}
                selectedCount={selectedIds.size}
                onRefresh={handleRefresh}
                onMarkAllRead={handleMarkAllRead}
                onArchiveSelected={handleArchiveSelected}
                onSpamSelected={handleSpamSelected}
                onNotSpamSelected={handleNotSpamSelected}
                onTrashSelected={handleTrashSelected}
                onRestoreSelected={handleRestoreSelected}
                onDeleteForeverSelected={handleDeleteForeverSelected}
                onEmptyTrash={handleEmptyTrash}
                refreshing={refreshing}
                updatedAt={lastRefreshedAt}
              />
              <MessageList
                emails={filteredEmails}
                activeEmailId={activeEmailId}
                selectedIds={selectedIds}
                onSelectEmail={handleSelectEmail}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onToggleStar={handleToggleStar}
                onArchive={handleArchive}
                onDelete={handleDelete}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
