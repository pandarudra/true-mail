import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireMailboxes } from "@/lib/require-mailboxes";
import { TasksClient } from "./TasksClient";

export default async function TasksPage() {
  const userId = (await getUserId(await headers()))!;
  const mailboxes = await requireMailboxes(userId);

  return (
    <TasksClient
      initialMailboxes={mailboxes.map((m) => ({ id: m.id, address: m.address, isDefault: m.isDefault }))}
    />
  );
}
