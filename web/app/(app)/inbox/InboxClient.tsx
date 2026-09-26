"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EnvelopeSimple, ListChecks, PencilSimpleLine } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { InboxToolbar } from "@/components/InboxToolbar";
import { MessageList } from "@/components/MessageList";
import { ReadingPane } from "@/components/ReadingPane";
import { StatTile } from "@/components/ui/StatTile";
import { useActiveEmail, useInboxStore, type Mailbox } from "@/lib/stores/inbox-store";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function InboxClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const activeEmail = useActiveEmail();
  const activeMailboxId = useInboxStore((s) => s.activeMailboxId);
  const activeFolder = useInboxStore((s) => s.activeFolder);
  const inboxUnreadCount = useInboxStore((s) => s.inboxUnreadCount);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // One-time store hydration from server-provided props. Guarded by the
  // store's own `initialized` flag. A layout effect (not the render body)
  // so the cross-component store update doesn't fire mid-render of this
  // component — React flags that as "update a component while rendering a
  // different component" whenever a sibling (e.g. AskInbox in TopBar) is
  // also subscribed. Layout effects still run before the browser paints,
  // so there's no visible flash of an empty mailbox list either.
  useLayoutEffect(() => {
    useInboxStore.getState().init(initialMailboxes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New mail (especially inbound, via webhook) doesn't push to the client —
  // poll in the background so it shows up without a manual refresh click.
  // Tied to this component's lifecycle (not the store), so it stops when
  // you navigate away from the inbox.
  useEffect(() => {
    const interval = setInterval(() => {
      void useInboxStore.getState().fetchFolderEmails();
      void useInboxStore.getState().refreshInboxUnreadCount();
    }, 20_000);
    return () => clearInterval(interval);
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    const emailId = searchParams.get("emailId");
    if (emailId) void useInboxStore.getState().selectEmail(emailId);
    // Intentionally runs once per mount only — this is a one-shot deep link,
    // not a synced-with-the-URL view; the reading pane's own state takes
    // over after the initial open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {activeEmail ? (
            <ReadingPane email={activeEmail} />
          ) : (
            <>
              {/* Mobile-only dashboard strip — desktop already has the
                  Sidebar's folder list and TopBar's search/actions right
                  there, so this would be redundant chrome above lg. */}
              <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 lg:hidden">
                <div>
                  <p className="text-xs text-text-secondary">{greeting()}</p>
                  <h1 className="text-lg font-semibold text-foreground">
                    {session?.user.name?.split(" ")[0] ?? "there"}&apos;s inbox
                  </h1>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile
                    icon={<EnvelopeSimple size={16} weight="bold" />}
                    label="Unread"
                    value={inboxUnreadCount}
                    tone="brand"
                  />
                  <StatTile
                    icon={<PencilSimpleLine size={16} weight="bold" />}
                    label="Compose"
                    tone="amber"
                    onClick={() => router.push("/compose")}
                  />
                  <StatTile
                    icon={<ListChecks size={16} weight="bold" />}
                    label="Tasks"
                    tone="emerald"
                    onClick={() => router.push("/tasks")}
                  />
                </div>
              </div>
              <InboxToolbar />
              <MessageList key={`${activeMailboxId}-${activeFolder}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
