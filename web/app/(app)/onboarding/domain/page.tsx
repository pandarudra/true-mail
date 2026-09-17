import { headers } from "next/headers";
import { getUserId } from "@/lib/session";
import { requireResendConnection } from "@/lib/require-resend-connection";
import { DomainClient } from "./DomainClient";

export default async function ConnectDomainPage() {
  const userId = (await getUserId(await headers()))!;
  await requireResendConnection(userId);

  return <DomainClient />;
}
