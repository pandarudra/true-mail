import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";
import { verifyDomain } from "@/lib/resend";
import { syncDomainStatus } from "@/lib/sync-domain-status";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const domain = await prisma.domain.findFirst({ where: { id, userId } });
  if (!domain) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const connectionResult = await getConnectionForUser(userId);
  if (!connectionResult) {
    return NextResponse.json({ error: "no Resend connection" }, { status: 400 });
  }
  const { resend } = connectionResult;

  await verifyDomain(resend, domain.resendDomainId);
  const updated = await syncDomainStatus(resend, domain);
  if (!updated) {
    return NextResponse.json(
      { error: "Failed to refresh domain status" },
      { status: 502 }
    );
  }

  return NextResponse.json({ domain: updated });
}
