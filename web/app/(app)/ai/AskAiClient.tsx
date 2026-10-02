"use client";

import { useLayoutEffect, useState } from "react";
import { PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { AiQuickStart } from "@/components/ai/AiQuickStart";
import { AiMessageBubble, type DisplayTurn } from "@/components/ai/AiMessageBubble";
import { readError } from "@/lib/api-error";
import { useInboxStore, type Mailbox } from "@/lib/stores/inbox-store";
import type { ChatTurn } from "@/lib/ai/orchestrator-shared";

export function AskAiClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const { data: session } = authClient.useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    useInboxStore.getState().init(initialMailboxes);
  }, [initialMailboxes]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    const nextTurns: DisplayTurn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(nextTurns);
    setLoading(true);

    const history: ChatTurn[] = nextTurns
      .filter((t): t is Extract<DisplayTurn, { role: "user" | "assistant" }> => t.role === "user" || t.role === "assistant")
      .map((t) => ({ role: t.role, content: t.content }));

    // A dropped connection or a non-JSON response (e.g. a dev-server
    // restart) must not leave the chat stuck on "Thinking…" forever — every
    // exit from this request, including a thrown one, clears loading and
    // surfaces something the user can act on.
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
      });

      if (!res.ok) {
        const errorMessage = await readError(res);
        setTurns((prev) => [...prev, { role: "error", content: errorMessage }]);
        return;
      }
      const result = await res.json();
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: result.message, citations: result.citations ?? [], actions: result.actions ?? [] },
      ]);
    } catch {
      setTurns((prev) => [...prev, { role: "error", content: "Lost the connection there for a second — mind trying that again?" }]);
    } finally {
      setLoading(false);
    }
  }

  const started = turns.length > 0;

  return (
    <div className="flex h-screen flex-col bg-surface-subtle">
      <TopBar
        user={{
          name: session?.user.name ?? "",
          email: session?.user.email ?? "",
          image: session?.user.image,
        }}
        onMenuClick={() => setSidebarOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden bg-surface">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          {started ? (
            <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
                {turns.map((turn, i) => (
                  <AiMessageBubble key={i} turn={turn} />
                ))}
                {loading && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-text-secondary">Tomy&apos;s thinking</span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- animated
                        gif; next/image would drop the animation on optimization */}
                    <img src="/gif/tomy_thinking_crop.gif" alt="" width={44} height={18} className="h-4 w-auto" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
              <Sparkle size={28} className="text-brand-500" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Hi, I&apos;m Tomy</h1>
                <p className="mt-1 text-sm text-text-secondary">
                  Your TrueMail AI. Ask me about your emails, tasks, promises, and calendar.
                </p>
              </div>
              <AiQuickStart onPick={setInput} />
            </div>
          )}

          <div className="border-t border-border p-4 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="mx-auto flex w-full max-w-2xl items-center gap-2"
            >
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What would you like to know?"
                className="flex-1"
                autoFocus
              />
              <IconButton type="submit" label="Send" disabled={!input.trim() || loading}>
                <PaperPlaneTilt size={16} />
              </IconButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
