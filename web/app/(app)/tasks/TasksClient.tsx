"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { TaskListNav } from "@/components/tasks/TaskListNav";
import { useTaskStore } from "@/lib/stores/task-store";

export function TasksClient() {
  const { data: session } = authClient.useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hydrated = useRef<true | null>(null);
  if (hydrated.current === null) {
    useTaskStore.getState().init();
    hydrated.current = true;
  }

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
          <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
            <p className="text-sm text-text-secondary">Task list goes here (Task 9).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
