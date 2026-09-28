"use client";

import { useLayoutEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { OverviewDashboard } from "@/components/overview/OverviewDashboard";
import { useInboxStore, type Mailbox } from "@/lib/stores/inbox-store";
import type { ActivityDay, Snapshot } from "@/lib/productivity-snapshot-shared";

export function OverviewClient({
  initialMailboxes,
  unreadCount,
  taskCount,
  snapshots,
  activity,
}: {
  initialMailboxes: Mailbox[];
  unreadCount: number;
  taskCount: number;
  snapshots: { tasks: Snapshot; promises: Snapshot; today: Snapshot };
  activity: ActivityDay[];
}) {
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
        <OverviewDashboard
          name={session?.user.name}
          unreadCount={unreadCount}
          taskCount={taskCount}
          snapshots={snapshots}
          activity={activity}
        />
      </div>
    </div>
  );
}
