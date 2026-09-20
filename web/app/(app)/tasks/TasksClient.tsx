"use client";

import { useLayoutEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { TaskListNav } from "@/components/tasks/TaskListNav";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useTaskStore, type Task } from "@/lib/stores/task-store";
import { useInboxStore, type Mailbox } from "@/lib/stores/inbox-store";

export function TasksClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const { data: session } = authClient.useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const tasks = useTaskStore((s) => s.tasks);
  const liveOpenTask = openTask ? tasks.find((t) => t.id === openTask.id) ?? null : null;

  // A layout effect, not the render body — see InboxClient.tsx for why a
  // cross-component store update needs to happen after React's render/commit
  // phase, not during it (avoids "update a component while rendering a
  // different component" whenever a sibling like TaskListNav is subscribed).
  //
  // inbox-store also gets hydrated here (not just on /inbox): the shared
  // Sidebar's Mailboxes/Labels sections read from it, and this page doesn't
  // otherwise mount InboxClient, the only other place that hydrates it.
  useLayoutEffect(() => {
    useInboxStore.getState().init(initialMailboxes);
    useTaskStore.getState().init();
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
        <div className="flex flex-1 overflow-hidden">
          <TaskListNav />
          <TaskList onOpenTask={setOpenTask} />
        </div>
      </div>
      <TaskDetailDialog task={liveOpenTask} onClose={() => setOpenTask(null)} />
    </div>
  );
}
