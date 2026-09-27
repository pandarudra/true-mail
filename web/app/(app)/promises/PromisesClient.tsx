"use client";

import { useLayoutEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { PromiseList } from "@/components/promises/PromiseList";
import { PromiseDetailDialog } from "@/components/promises/PromiseDetailDialog";
import { usePromiseStore, type PromiseRecord } from "@/lib/stores/promise-store";
import { useInboxStore, type Mailbox } from "@/lib/stores/inbox-store";

export function PromisesClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const { data: session } = authClient.useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openPromise, setOpenPromise] = useState<PromiseRecord | null>(null);
  const promises = usePromiseStore((s) => s.promises);
  const livePromise = openPromise ? (promises.find((p) => p.id === openPromise.id) ?? null) : null;

  // Same reasoning as TasksClient.tsx: Sidebar's Mailboxes/Labels sections
  // read from inbox-store, and this page doesn't otherwise mount InboxClient.
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
        <PromiseList onOpen={setOpenPromise} />
      </div>
      <PromiseDetailDialog promise={livePromise} onClose={() => setOpenPromise(null)} />
    </div>
  );
}
