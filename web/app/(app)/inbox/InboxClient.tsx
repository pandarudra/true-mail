"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { InboxToolbar } from "@/components/InboxToolbar";
import { MessageList } from "@/components/MessageList";
import { ReadingPane } from "@/components/ReadingPane";
import { useActiveEmail, useInboxStore, type Mailbox } from "@/lib/stores/inbox-store";

export function InboxClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const { data: session } = authClient.useSession();
  const activeEmail = useActiveEmail();
  const activeMailboxId = useInboxStore((s) => s.activeMailboxId);
  const activeFolder = useInboxStore((s) => s.activeFolder);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // One-time store hydration from server-provided props. Guarded by the
  // store's own `initialized` flag, and done synchronously during render
  // (not an effect) so child components never see an empty mailbox list on
  // first paint — this store only ever backs this one page.
  const hydrated = useRef<true | null>(null);
  if (hydrated.current === null) {
    useInboxStore.getState().init(initialMailboxes);
    hydrated.current = true;
  }

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
              <InboxToolbar />
              <MessageList key={`${activeMailboxId}-${activeFolder}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
