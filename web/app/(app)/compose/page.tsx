"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mailbox = { id: string; address: string };

export default function ComposePage() {
  const router = useRouter();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxId, setMailboxId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/mailboxes")
      .then((res) => res.json())
      .then(({ mailboxes: all }: { mailboxes: Mailbox[] }) => {
        setMailboxes(all);
        if (all[0]) setMailboxId(all[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const res = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId,
        to: to.split(",").map((addr) => addr.trim()).filter(Boolean),
        subject,
        text,
      }),
    });
    setSending(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Failed to send");
      return;
    }
    router.push("/inbox");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-2xl flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold text-foreground">Compose</h1>
        <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/15">
          <span className="w-16 text-zinc-500">From</span>
          <select
            value={mailboxId}
            onChange={(e) => setMailboxId(e.target.value)}
            className="flex-1 bg-transparent"
          >
            {mailboxes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.address}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/15">
          <span className="w-16 text-zinc-500">To</span>
          <input
            type="text"
            placeholder="someone@example.com, another@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            className="flex-1 bg-transparent outline-none"
          />
        </label>
        <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/15">
          <span className="w-16 text-zinc-500">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="flex-1 bg-transparent outline-none"
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={12}
          className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={sending || !mailboxId}
          className="self-start rounded-md bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </main>
  );
}
