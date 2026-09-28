"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle, PaperPlaneTilt, X } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { RecurrenceEditor, toRecurrenceInput, type RecurrenceValue } from "@/components/tasks/RecurrenceEditor";
import { usePromiseStore, type PromiseRecord } from "@/lib/stores/promise-store";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  DUE_SOON: "Due soon",
  OVERDUE: "Overdue",
  FULFILLED: "Fulfilled",
  DISMISSED: "Dismissed",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function PromiseDetailDialog({ promise, onClose }: { promise: PromiseRecord | null; onClose: () => void }) {
  const router = useRouter();
  const fulfill = usePromiseStore((s) => s.fulfill);
  const dismiss = usePromiseStore((s) => s.dismiss);
  const createTaskFromPromise = usePromiseStore((s) => s.createTaskFromPromise);

  const [confirmingDismiss, setConfirmingDismiss] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [followingUp, setFollowingUp] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!promise) return null;

  const canFollowUp = promise.direction === "INCOMING" && promise.derivedStatus === "OVERDUE" && promise.sourceEmail;

  async function handleCreateTask() {
    setCreatingTask(true);
    setError(null);
    const { error } = await createTaskFromPromise(promise!.id, toRecurrenceInput(recurrence));
    setCreatingTask(false);
    if (error) setError(error);
  }

  // Reuses the existing custom-reply generator and the same
  // sessionStorage → Compose handoff AiReplyBar already uses — no new AI
  // route or send pathway for follow-ups (spec §14: draft only, never
  // auto-sent — the user still reviews it in Compose before sending).
  async function handleFollowUp() {
    if (!promise!.sourceEmail) return;
    setFollowingUp(true);
    setError(null);
    const res = await fetch("/api/ai/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailId: promise!.sourceEmail.id,
        intent: "custom",
        customInstruction: `Write a brief, friendly follow-up asking whether they've completed: ${promise!.commitment}`,
      }),
    });
    setFollowingUp(false);
    if (!res.ok) {
      setError("Couldn't generate a follow-up. Try again.");
      return;
    }
    const { text } = await res.json();
    sessionStorage.setItem("truemail:ai-draft", text);
    router.push(`/compose?replyTo=${promise!.sourceEmail.id}&mode=reply`);
  }

  return (
    <>
      <Dialog open={promise !== null} onClose={onClose} title="Promise">
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-sm font-medium text-foreground">{promise.commitment}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {promise.direction === "INCOMING"
                ? `Waiting on ${promise.personName ?? promise.personEmail ?? "someone"}`
                : promise.personName || promise.personEmail
                  ? `Promised to ${promise.personName ?? promise.personEmail}`
                  : "A promise to yourself"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border px-2.5 py-1 text-text-secondary">
              {STATUS_LABEL[promise.derivedStatus]}
            </span>
            {promise.dueAt && (
              <span className="rounded-full border border-border px-2.5 py-1 text-text-secondary">
                Due {formatDate(promise.dueAt)}
              </span>
            )}
          </div>

          {promise.sourceEmail && (
            <a
              href={`/inbox?emailId=${promise.sourceEmail.id}`}
              className="w-fit rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-subtle"
            >
              Open source email: {promise.sourceEmail.subject}
            </a>
          )}

          {promise.relatedTask ? (
            <a
              href="/tasks"
              className="w-fit rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-subtle"
            >
              Linked task: {promise.relatedTask.title}
            </a>
          ) : (
            <div className="flex flex-col gap-2">
              <RecurrenceEditor value={recurrence} onChange={setRecurrence} />
              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateTask}
                disabled={creatingTask}
                className="w-fit"
              >
                <CalendarPlus size={14} />
                {creatingTask ? "Creating…" : "Create Task"}
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {promise.derivedStatus !== "FULFILLED" && promise.derivedStatus !== "DISMISSED" && (
              <Button type="button" onClick={() => fulfill(promise.id)} className="w-fit">
                <CheckCircle size={14} />
                Mark Fulfilled
              </Button>
            )}
            {canFollowUp && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleFollowUp}
                disabled={followingUp}
                className="w-fit"
              >
                <PaperPlaneTilt size={14} />
                {followingUp ? "Drafting…" : "Follow Up"}
              </Button>
            )}
            {promise.derivedStatus !== "DISMISSED" && (
              <Button type="button" variant="secondary" onClick={() => setConfirmingDismiss(true)} className="w-fit">
                <X size={14} />
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmingDismiss}
        title="Dismiss promise"
        message={`Dismiss "${promise.commitment}"? It'll stop showing as active, but you can still find it later.`}
        confirmLabel="Dismiss"
        danger={false}
        onCancel={() => setConfirmingDismiss(false)}
        onConfirm={() => {
          dismiss(promise.id);
          setConfirmingDismiss(false);
          onClose();
        }}
      />
    </>
  );
}
