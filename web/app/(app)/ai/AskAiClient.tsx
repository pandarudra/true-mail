"use client";

import { useLayoutEffect, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { AiQuickStart } from "@/components/ai/AiQuickStart";
import { useInboxStore, type Mailbox } from "@/lib/stores/inbox-store";

export function AskAiClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const { data: session } = authClient.useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Same reasoning as PromisesClient/TasksClient: Sidebar's Mailboxes/Labels
  // sections read from inbox-store, and this page doesn't otherwise mount
  // InboxClient.
  useLayoutEffect(() => {
    useInboxStore.getState().init(initialMailboxes);
  }, [initialMailboxes]);

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
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
          <Sparkle size={28} className="text-brand-500" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Ask AI</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Your email, understood. Ask about your emails, tasks, promises, and calendar.
            </p>
          </div>
          <AiQuickStart onPick={(prompt) => console.log(prompt)} />
        </div>
      </div>
    </div>
  );
}
