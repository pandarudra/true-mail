"use client";

import { useState } from "react";
import { MagnifyingGlass, Robot } from "@phosphor-icons/react";
import { DrawablyBadge, DrawablyCard } from "drawably/react";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { readError } from "@/lib/api-error";
import { useInboxStore } from "@/lib/stores/inbox-store";

type AskResult = {
  answer: string;
  cited: { id: string; from: string; subject: string }[];
};

export function AskInbox() {
  const query = useInboxStore((s) => s.query);
  const setQuery = useInboxStore((s) => s.setQuery);
  const activeMailboxId = useInboxStore((s) => s.activeMailboxId);
  const selectEmail = useInboxStore((s) => s.selectEmail);

  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResult | null>(null);

  function toggleAsking() {
    setAsking((v) => !v);
    setError(null);
    setResult(null);
    setQuestion("");
  }

  async function submit() {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailboxId: activeMailboxId, question: trimmed }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    setResult(await res.json());
  }

  const panelOpen = asking && (loading || error || result);

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <MagnifyingGlass
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-muted"
      />
      {asking ? (
        <Input
          type="text"
          autoFocus
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask your inbox…"
          className="pl-10 pr-10"
        />
      ) : (
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mail"
          className="pl-10 pr-10"
        />
      )}
      <span className="absolute right-1 top-1/2 -translate-y-1/2">
        <IconButton
          label={asking ? "Back to normal search" : "Ask your inbox with AI"}
          tone={asking ? "active" : "default"}
          onClick={toggleAsking}
          className="border-none"
        >
          <Robot size={16} />
        </IconButton>
      </span>
      {panelOpen && (
        <>
          <button
            type="button"
            aria-label="Close results"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setResult(null)}
          />
          <div className="absolute left-0 right-0 top-full z-20 mt-2">
            <DrawablyCard
              roughness={0.3}
              boil={0.1}
              className="bg-surface p-4 text-left"
            >
              {loading && (
                <p className="text-sm text-text-secondary">Thinking…</p>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {result && (
                <>
                  <p className="text-sm text-foreground">{result.answer}</p>
                  {result.cited.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {result.cited.map((email) => (
                        <button
                          key={email.id}
                          type="button"
                          onClick={() => void selectEmail(email.id)}
                        >
                          <DrawablyBadge
                            roughness={0.3}
                            boil={0.1}
                            className="max-w-64 truncate text-xs"
                          >
                            {email.from} — {email.subject}
                          </DrawablyBadge>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </DrawablyCard>
          </div>
        </>
      )}
    </div>
  );
}
