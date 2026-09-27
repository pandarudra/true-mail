import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireMailboxes } from "@/lib/require-mailboxes";
import { PromisesClient } from "./PromisesClient";

export default async function PromisesPage() {
  const userId = (await getUserId(await headers()))!;
  const mailboxes = await requireMailboxes(userId);

  return (
    <PromisesClient
      initialMailboxes={mailboxes.map((m) => ({ id: m.id, address: m.address, isDefault: m.isDefault }))}
    />
  );
}
