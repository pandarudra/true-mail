import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const mailboxes = await prisma.mailbox.findMany({ where: { userId } });
  return NextResponse.json({ mailboxes });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const domainId: string | undefined = body?.domainId;
  const localPart: string | undefined = body?.localPart;
  const displayName: string | undefined = body?.displayName;

  if (!domainId || !localPart) {
    return NextResponse.json(
      { error: "domainId and localPart are required" },
      { status: 400 }
    );
  }

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, userId },
  });
  if (!domain) {
    return NextResponse.json({ error: "domain not found" }, { status: 404 });
  }
  if (domain.status !== "verified") {
    return NextResponse.json(
      { error: "domain is not verified yet" },
      { status: 400 }
    );
  }

  const address = `${localPart}@${domain.name}`;
  try {
    const mailbox = await prisma.mailbox.create({
      data: { userId, domainId, localPart, address, displayName },
    });
    return NextResponse.json({ mailbox });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: `${address} is already taken` },
        { status: 409 }
      );
    }
    throw error;
  }
}
