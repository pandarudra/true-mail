import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";

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

  await resend.domains.verify(domain.resendDomainId);
  const { data, error } = await resend.domains.get(domain.resendDomainId);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to refresh domain status" },
      { status: 502 }
    );
  }

  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: { status: data.status },
  });

  return NextResponse.json({ domain: updated });
}
