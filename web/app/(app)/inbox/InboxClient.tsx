"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { InboxToolbar } from "@/components/InboxToolbar";
import { MessageList } from "@/components/MessageList";
import { ReadingPane } from "@/components/ReadingPane";
import { matchesFolder, type FolderId } from "@/lib/mail-folders";
import { readError } from "@/lib/api-error";

type Mailbox = { id: string; address: string; isDefault: boolean };
type Label = { id: string; name: string; color: string };
type Attachment = { id: string; filename: string; contentType: string; size: number | null };
type Email = {
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

export function InboxClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>(initialMailboxes);
  const [activeMailboxId, setActiveMailboxId] = useState<string>(
    initialMailboxes.find((m) => m.isDefault)?.id ?? initialMailboxes[0].id
  );
  const [activeFolder, setActiveFolder] = useState<FolderId>("inbox");
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  // Independent of activeFolder — the sidebar's Inbox badge must stay
  // accurate even while viewing a different folder.
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  function folderEmailsUrl() {
    const labelParam = activeLabelId ? `&labelId=${activeLabelId}` : "";
    return `/api/emails?mailboxId=${activeMailboxId}&folder=${activeFolder}${labelParam}`;
  }

  async function fetchFolderEmails() {
    const res = await fetch(folderEmailsUrl());
    const { emails: all } = await res.json();
    setEmails(all);
    setLastRefreshedAt(new Date());
  }

  useEffect(() => {
    fetch(folderEmailsUrl())
      .then((res) => res.json())
      .then(({ emails: all }: { emails: Email[] }) => {
        setEmails(all);
        setLastRefreshedAt(new Date());
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMailboxId, activeFolder, activeLabelId]);

  async function fetchLabels() {
    const res = await fetch("/api/labels");
    const { labels: all } = await res.json();
    setLabels(all);
  }

  useEffect(() => {
    fetch("/api/labels")
      .then((res) => res.json())
      .then(({ labels: all }: { labels: Label[] }) => setLabels(all));
  }, []);

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
  }, [activeMailboxId, activeFolder, activeLabelId]);

  function resetSelection() {
    setSelectedIds(new Set());
    setActiveEmailId(null);
  }

  function handleSelectMailbox(id: string) {
    setActiveMailboxId(id);
    setActiveLabelId(null);
    resetSelection();
  }

  function handleSelectFolder(folder: FolderId) {
    setActiveFolder(folder);
    resetSelection();
  }

  function handleSelectLabel(id: string | null) {
    setActiveLabelId((prev) => (prev === id ? null : id));
    resetSelection();
  }

  async function handleCreateLabel(name: string, color: string) {
    await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    void fetchLabels();
  }

  async function handleRenameLabel(id: string, name: string, color: string) {
    await fetch(`/api/labels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    await fetchLabels();
    void fetchFolderEmails();
  }

  async function handleDeleteLabel(id: string) {
    await fetch(`/api/labels/${id}`, { method: "DELETE" });
    if (activeLabelId === id) setActiveLabelId(null);
    await fetchLabels();
    void fetchFolderEmails();
  }

  async function handleSetEmailLabels(id: string, labelIds: string[]) {
    const res = await fetch(`/api/emails/${id}/labels`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelIds }),
    });
    const { email } = await res.json();
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, labels: email.labels } : e)));
  }

  async function handleCreateMailbox(domainId: string, localPart: string) {
    const res = await fetch("/api/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId, localPart }),
    });
    if (!res.ok) {
      return { error: await readError(res) };
    }
    const { mailbox } = await res.json();
    setMailboxes((prev) => [
      ...prev,
      { id: mailbox.id, address: mailbox.address, isDefault: mailbox.isDefault },
    ]);
    setActiveMailboxId(mailbox.id);
    resetSelection();
    return {};
  }

  async function handleSetPrimaryMailbox(id: string) {
    await fetch(`/api/mailboxes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setMailboxes((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
  }

  async function handleDeleteMailbox(id: string) {
    const res = await fetch(`/api/mailboxes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      return { error: await readError(res) };
    }
    const next = mailboxes.filter((m) => m.id !== id);
    setMailboxes(next);
    if (activeMailboxId === id) {
      setActiveMailboxId(next.find((m) => m.isDefault)?.id ?? next[0].id);
      resetSelection();
    }
    return {};
  }

  async function handleRefresh() {
    setRefreshing(true);
    const res = await fetch(folderEmailsUrl());
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
    if (activeFolder === "drafts") {
      router.push(`/compose?draft=${id}`);
      return;
    }
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
          labels={labels}
          activeLabelId={activeLabelId}
          onSelectLabel={handleSelectLabel}
          onCreateLabel={handleCreateLabel}
          onRenameLabel={handleRenameLabel}
          onDeleteLabel={handleDeleteLabel}
          onCreateMailbox={handleCreateMailbox}
          onSetPrimaryMailbox={handleSetPrimaryMailbox}
          onDeleteMailbox={handleDeleteMailbox}
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
              labels={labels}
              onSetLabels={handleSetEmailLabels}
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
                key={`${activeMailboxId}-${activeFolder}`}
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
