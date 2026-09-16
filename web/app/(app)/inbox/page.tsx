"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
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

export default function InboxPage() {
  const router = useRouter();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mailboxes")
      .then((res) => res.json())
      .then(({ mailboxes: all }: { mailboxes: Mailbox[] }) => {
        if (all.length === 0) {
          router.push("/onboarding/mailbox");
          return;
        }
        setMailboxes(all);
        setActiveMailboxId(all[0].id);
      });
  }, [router]);

  useEffect(() => {
    if (!activeMailboxId) return;
    fetch(`/api/emails?mailboxId=${activeMailboxId}`)
      .then((res) => res.json())
      .then(({ emails: all }: { emails: Email[] }) => setEmails(all));
  }, [activeMailboxId]);

  async function handleSelectEmail(id: string) {
    setActiveEmailId(id);
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, read: true } : e))
    );
  }

  async function handleToggleStar(id: string, starred: boolean) {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, starred } : e))
    );
  }

  async function handleDelete(id: string) {
    await fetch(`/api/emails/${id}`, { method: "DELETE" });
    setEmails((prev) => prev.filter((e) => e.id !== id));
    setActiveEmailId(null);
  }

  const activeEmail = emails.find((e) => e.id === activeEmailId) ?? null;

  return (
    <div className="flex h-screen">
      <Sidebar
        mailboxes={mailboxes}
        activeMailboxId={activeMailboxId}
        onSelectMailbox={(id) => {
          setActiveMailboxId(id);
          setActiveEmailId(null);
        }}
      />
      <div className="flex w-96 flex-col border-r border-black/10 dark:border-white/15">
        <MessageList
          emails={emails}
          activeEmailId={activeEmailId}
          onSelectEmail={handleSelectEmail}
        />
      </div>
      <ReadingPane
        email={activeEmail}
        onToggleStar={handleToggleStar}
        onDelete={handleDelete}
      />
    </div>
  );
}
