import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireMailboxes } from "@/lib/require-mailboxes";
import { CalClient } from "./CalClient";

export default async function CalPage() {
  const userId = (await getUserId(await headers()))!;
  const mailboxes = await requireMailboxes(userId);

  return (
    <CalClient
      initialMailboxes={mailboxes.map((m) => ({ id: m.id, address: m.address, isDefault: m.isDefault }))}
    />
  );
}
