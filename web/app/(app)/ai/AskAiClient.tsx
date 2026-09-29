"use client";

import { useLayoutEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
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
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-secondary">Ask AI is loading…</p>
        </div>
      </div>
    </div>
  );
}
