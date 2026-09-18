"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PaperPlaneTilt } from "@phosphor-icons/react";
import { DrawablyCard, DrawablyDivider, DrawablyTextarea } from "drawably/react";
import { Button } from "@/components/ui/Button";
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
          <h1 className="text-xl font-semibold text-foreground">New message</h1>
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={sending || !mailboxId} className="w-fit self-start">
            <PaperPlaneTilt size={16} weight="bold" />
            {sending ? "Sending..." : "Send"}
          </Button>
        </form>
      </DrawablyCard>
    </main>
  );
}
