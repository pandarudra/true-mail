import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { requireResendConnection } from "@/lib/require-resend-connection";
import { getConnectionForUser } from "@/lib/resend-client";
import { getDomains } from "@/lib/resend";
import { syncDomainStatus } from "@/lib/sync-domain-status";
import { DomainClient, type Domain } from "./DomainClient";

export default async function ConnectDomainPage() {
  const userId = (await getUserId(await headers()))!;
  await requireResendConnection(userId);

  const [imported, connectionResult] = await Promise.all([
    prisma.domain.findMany({ where: { userId } }),
    getConnectionForUser(userId),
  ]);

  // Already have a domain? Reflect its live Resend status rather than
  // whatever was last saved — verification can finish between visits
  // without the user ever clicking "Verify domain" here.
  let existing = imported[0] ?? null;
  if (existing && existing.status !== "verified" && connectionResult) {
    existing = (await syncDomainStatus(connectionResult.resend, existing)) ?? existing;
  }
  if (existing?.status === "verified") {
    redirect("/onboarding/mailbox");
  }

  const importedIds = new Set(imported.map((d) => d.resendDomainId));
  const listResult = connectionResult ? await getDomains(connectionResult.resend) : undefined;
  const importable = (listResult?.data?.data ?? [])
    .filter((d) => !importedIds.has(d.id))
    .map((d) => ({ id: d.id, name: d.name, status: d.status }));

  return (
    <DomainClient
      importable={importable}
      initialDomain={
        existing
          ? {
              id: existing.id,
              name: existing.name,
              status: existing.status,
              dnsRecords: existing.dnsRecords as Domain["dnsRecords"],
            }
          : null
      }
    />
  );
}
