import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireMailboxes } from "@/lib/require-mailboxes";
import { getDailySummary } from "@/lib/telegram/summary";
import { getTaskSnapshot, getPromiseSnapshot, getTodaySnapshot } from "@/lib/productivity-snapshot";
import { OverviewClient } from "./OverviewClient";

export default async function OverviewPage() {
  const userId = (await getUserId(await headers()))!;
  const mailboxes = await requireMailboxes(userId);

  const [daily, tasksSnapshot, promisesSnapshot, todaySnapshot] = await Promise.all([
    getDailySummary(userId),
    getTaskSnapshot(userId),
    getPromiseSnapshot(userId),
    getTodaySnapshot(userId),
  ]);

  return (
    <OverviewClient
      initialMailboxes={mailboxes.map((m) => ({ id: m.id, address: m.address, isDefault: m.isDefault }))}
      unreadCount={daily.email.unreadCount}
      taskCount={daily.tasks.overdue.length + daily.tasks.today.length}
      snapshots={{ tasks: tasksSnapshot, promises: promisesSnapshot, today: todaySnapshot }}
    />
  );
}
