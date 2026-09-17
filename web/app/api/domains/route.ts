import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";
import { createDomain, updateDomain, getDomain } from "@/lib/resend";

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
  const resendDomainId: string | undefined = body?.resendDomainId;
  if (!resendDomainId && (!name || typeof name !== "string")) {
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

  let data: { id: string; name: string; status: string; records: unknown };
  if (resendDomainId) {
    // Importing a domain that already exists in the user's Resend account —
    // don't touch its capabilities, it may already be configured on purpose.
    const getResult = await getDomain(resend, resendDomainId);
    if (!getResult?.data) {
      return NextResponse.json(
        { error: "Failed to load domain from Resend" },
        { status: 502 }
      );
    }
    data = getResult.data;
  } else {
    const createResult = await createDomain(resend, { name: name! });
    if (!createResult?.data) {
      return NextResponse.json(
        { error: "Failed to create domain in Resend" },
        { status: 502 }
      );
    }
    data = createResult.data;
    await updateDomain(resend, {
      id: data.id,
      capabilities: { sending: "enabled", receiving: "enabled" },
    });
  }

  const domain = await prisma.domain.create({
    data: {
      userId,
      connectionId: connection.id,
      resendDomainId: data.id,
      name: data.name,
      status: data.status,
      dnsRecords: JSON.parse(JSON.stringify(data.records)),
    },
  });

  return NextResponse.json({ domain });
}
