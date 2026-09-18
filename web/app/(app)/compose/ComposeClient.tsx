"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PaperPlaneTilt } from "@phosphor-icons/react";
import { readError } from "@/lib/api-error";

type Mailbox = { id: string; address: string };

export function ComposeClient({ mailboxes }: { mailboxes: Mailbox[] }) {
  const router = useRouter();
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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
      setError(await readError(res));
      return;
    }
    router.push("/inbox");
  }

  return (
    <main className="flex min-h-screen justify-center bg-brand-50/50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-2xl rounded-2xl border border-black/4 bg-white p-8 shadow-sm dark:border-white/5 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => router.push("/inbox")}
          className="mb-6 flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to inbox
        </button>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-foreground">New message</h1>
          <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/10">
            <span className="w-16 shrink-0 text-zinc-500">From</span>
            <select
              value={mailboxId}
              onChange={(e) => setMailboxId(e.target.value)}
              className="flex-1 bg-transparent outline-none"
            >
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/10">
            <span className="w-16 shrink-0 text-zinc-500">To</span>
            <input
              type="text"
              placeholder="someone@example.com, another@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              className="flex-1 bg-transparent outline-none"
            />
          </label>
          <label className="flex items-center gap-3 border-b border-black/10 py-2 text-sm dark:border-white/10">
            <span className="w-16 shrink-0 text-zinc-500">Subject</span>
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
            placeholder="Write your message..."
            className="rounded-xl border border-black/10 p-3 text-sm outline-none transition-colors focus:border-brand-400 dark:border-white/10"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={sending || !mailboxId}
            className="flex w-fit items-center gap-2 self-start rounded-full bg-brand-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-800/20 transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <PaperPlaneTilt size={16} weight="bold" />
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}
