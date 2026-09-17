import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireMailboxes } from "@/lib/require-mailboxes";
import { InboxClient } from "./InboxClient";

export default async function InboxPage() {
  const userId = (await getUserId(await headers()))!;
  const mailboxes = await requireMailboxes(userId);

  return (
    <InboxClient
      initialMailboxes={mailboxes.map((m) => ({ id: m.id, address: m.address }))}
    />
  );
}
