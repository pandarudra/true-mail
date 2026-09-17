import type { Resend } from "resend";
import { prisma } from "@/lib/db";
import { getDomain } from "@/lib/resend";

export async function syncDomainStatus(
  resend: Resend,
  domain: { id: string; resendDomainId: string }
) {
  const getResult = await getDomain(resend, domain.resendDomainId);
  if (!getResult?.data) return null;
  return prisma.domain.update({
    where: { id: domain.id },
    data: {
      status: getResult.data.status,
      dnsRecords: JSON.parse(JSON.stringify(getResult.data.records)),
    },
  });
}
