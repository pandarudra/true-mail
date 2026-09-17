import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireResendConnection } from "@/lib/require-resend-connection";

export async function requireVerifiedDomain(userId: string) {
  await requireResendConnection(userId);
  const domains = await prisma.domain.findMany({
    where: { userId, status: "verified" },
  });
  if (domains.length === 0) {
    redirect("/onboarding/domain");
  }
  return domains;
}
