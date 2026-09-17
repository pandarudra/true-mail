import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireVerifiedDomain } from "@/lib/require-verified-domain";
import { MailboxClient } from "./MailboxClient";

export default async function CreateMailboxPage() {
  const userId = (await getUserId(await headers()))!;
  const domains = await requireVerifiedDomain(userId);

  return (
    <MailboxClient domains={domains.map((d) => ({ id: d.id, name: d.name }))} />
  );
}
