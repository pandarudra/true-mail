import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireMailboxes } from "@/lib/require-mailboxes";
import { ComposeClient } from "./ComposeClient";

export default async function ComposePage() {
  const userId = (await getUserId(await headers()))!;
  const mailboxes = await requireMailboxes(userId);

  return (
    <ComposeClient
      mailboxes={mailboxes.map((m) => ({ id: m.id, address: m.address }))}
    />
  );
}
