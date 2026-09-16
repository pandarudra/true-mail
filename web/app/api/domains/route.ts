import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const domains = await prisma.domain.findMany({ where: { userId } });
  return NextResponse.json({ domains });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name: string | undefined = body?.name;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const connectionResult = await getConnectionForUser(userId);
  if (!connectionResult) {
    return NextResponse.json(
      { error: "Connect a Resend account first" },
      { status: 400 }
    );
  }
  const { connection, resend } = connectionResult;

  const { data, error } = await resend.domains.create({ name });
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create domain in Resend" },
      { status: 502 }
    );
  }

  await resend.domains.update({
    id: data.id,
    capabilities: { sending: "enabled", receiving: "enabled" },
  });

  const domain = await prisma.domain.create({
    data: {
      userId,
      connectionId: connection.id,
      resendDomainId: data.id,
      name,
      status: "pending",
      dnsRecords: JSON.parse(JSON.stringify(data.records)),
    },
  });

  return NextResponse.json({ domain });
}
