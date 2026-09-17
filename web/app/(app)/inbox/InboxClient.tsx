"use client";

import { useMemo, useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { Sidebar } from "@/components/Sidebar";
import { InboxToolbar } from "@/components/InboxToolbar";
import { MessageList } from "@/components/MessageList";
import { ReadingPane } from "@/components/ReadingPane";

type Mailbox = { id: string; address: string };
type Email = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  read: boolean;
  starred: boolean;
  createdAt: string;
};

export function InboxClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const { data: session } = authClient.useSession();
  const [mailboxes] = useState<Mailbox[]>(initialMailboxes);
  const [activeMailboxId, setActiveMailboxId] = useState<string>(initialMailboxes[0].id);
  const [emails, setEmails] = useState<Email[]>([]);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch(`/api/emails?mailboxId=${activeMailboxId}`)
      .then((res) => res.json())
      .then(({ emails: all }: { emails: Email[] }) => setEmails(all));
  }, [activeMailboxId]);

  function handleSelectMailbox(id: string) {
    setActiveMailboxId(id);
    setSelectedIds(new Set());
    setActiveEmailId(null);
  }

  async function handleRefresh() {
    setRefreshing(true);
    const res = await fetch(`/api/emails?mailboxId=${activeMailboxId}`);
    const { emails: all } = await res.json();
    setEmails(all);
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

  const unreadCount = emails.filter((e) => !e.read).length;

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
  }

  async function handleToggleStar(id: string, starred: boolean) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, starred } : e)));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/emails/${id}`, { method: "DELETE" });
    setEmails((prev) => prev.filter((e) => e.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setActiveEmailId((prev) => (prev === id ? null : prev));
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

  async function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => fetch(`/api/emails/${id}`, { method: "DELETE" })));
    setEmails((prev) => prev.filter((e) => !selectedIds.has(e.id)));
    setSelectedIds(new Set());
    setActiveEmailId((prev) => (prev && selectedIds.has(prev) ? null : prev));
  }

  async function handleMarkAllRead() {
    const unread = emails.filter((e) => !e.read);
    await Promise.all(
      unread.map((e) =>
        fetch(`/api/emails/${e.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        })
      )
    );
    setEmails((prev) => prev.map((e) => ({ ...e, read: true })));
  }

  const activeEmail = emails.find((e) => e.id === activeEmailId) ?? null;

  return (
    <div className="flex h-screen">
      <Sidebar
        user={{
          name: session?.user.name ?? "",
          email: session?.user.email ?? "",
        }}
        mailboxes={mailboxes}
        activeMailboxId={activeMailboxId}
        unreadCount={unreadCount}
        onSelectMailbox={handleSelectMailbox}
      />
      <div className="flex w-104 shrink-0 flex-col border-r border-black/10 dark:border-white/10">
        <InboxToolbar
          totalCount={filteredEmails.length}
          unreadCount={unreadCount}
          selectedCount={selectedIds.size}
          query={query}
          onQueryChange={setQuery}
          onRefresh={handleRefresh}
          onMarkAllRead={handleMarkAllRead}
          onDeleteSelected={handleDeleteSelected}
          refreshing={refreshing}
        />
        <MessageList
          emails={filteredEmails}
          activeEmailId={activeEmailId}
          selectedIds={selectedIds}
          onSelectEmail={handleSelectEmail}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onDelete={handleDelete}
        />
      </div>
      <ReadingPane email={activeEmail} onToggleStar={handleToggleStar} onDelete={handleDelete} />
    </div>
  );
}
