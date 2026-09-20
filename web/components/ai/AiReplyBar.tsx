"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, PaperPlaneTilt, PencilSimpleLine, Question, Robot, ThumbsUp, X } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { readError } from "@/lib/api-error";

const INTENTS = [
  { id: "accept", label: "Accept", icon: Check },
  { id: "decline", label: "Decline", icon: X },
  { id: "ask_details", label: "Ask for details", icon: Question },
  { id: "thank", label: "Thank them", icon: ThumbsUp },
  { id: "follow_up", label: "Follow up", icon: Clock },
] as const;

type IntentId = (typeof INTENTS)[number]["id"] | "custom";

export function AiReplyBar({ emailId }: { emailId: string }) {
  const router = useRouter();
  const [loadingIntent, setLoadingIntent] = useState<IntentId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");

  async function generate(intent: IntentId, customInstruction?: string) {
    setLoadingIntent(intent);
    setError(null);
    const res = await fetch("/api/ai/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId, intent, customInstruction }),
    });
    setLoadingIntent(null);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const { text } = await res.json();
    sessionStorage.setItem("truemail:ai-draft", text);
    router.push(`/compose?replyTo=${emailId}&mode=reply`);
  }

  function submitCustom() {
    const trimmed = customText.trim();
    if (!trimmed || loadingIntent) return;
    void generate("custom", trimmed);
  }

  const busy = loadingIntent !== null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <Robot size={16} className="shrink-0 text-brand-600 dark:text-brand-300" />
      <span className="mr-1 text-xs font-medium text-text-secondary">
        {busy ? "Generating…" : "AI Reply"}
      </span>
      {INTENTS.map(({ id, label, icon: Icon }) => (
        <IconButton
          key={id}
          label={label}
          disabled={busy}
          onClick={() => void generate(id)}
          className="h-8 w-8"
        >
          <Icon size={16} />
        </IconButton>
      ))}
      <IconButton
        label="Custom reply"
        disabled={busy}
        onClick={() => setCustomOpen((v) => !v)}
        tone={customOpen ? "active" : "default"}
        className="h-8 w-8"
      >
        <PencilSimpleLine size={16} />
      </IconButton>
      {customOpen && (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Input
            type="text"
            autoFocus
            placeholder="Tell the AI what to say…"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCustom()}
            disabled={busy}
            className="min-w-0 flex-1"
          />
          <IconButton label="Generate custom reply" disabled={busy || !customText.trim()} onClick={submitCustom}>
            <PaperPlaneTilt size={16} />
          </IconButton>
        </div>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
