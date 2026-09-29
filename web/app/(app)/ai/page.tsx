import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireMailboxes } from "@/lib/require-mailboxes";
import { AskAiClient } from "./AskAiClient";

export default async function AskAiPage() {
  const userId = (await getUserId(await headers()))!;
  const mailboxes = await requireMailboxes(userId);

  return (
    <AskAiClient
      initialMailboxes={mailboxes.map((m) => ({ id: m.id, address: m.address, isDefault: m.isDefault }))}
    />
  );
}
