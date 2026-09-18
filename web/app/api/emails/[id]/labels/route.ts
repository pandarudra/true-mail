import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// Replaces an email's full label set in one call — the UI sends the desired
// set from a checkbox list rather than toggling one label at a time.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.email.findFirst({ where: { id, mailbox: { userId } } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const labelIds: string[] = Array.isArray(body?.labelIds) ? body.labelIds : [];

  // Ownership check: only ever attach labels this user owns.
  const owned = await prisma.label.findMany({
    where: { id: { in: labelIds }, userId },
    select: { id: true },
  });

  const email = await prisma.email.update({
    where: { id },
    data: { labels: { set: owned.map((l) => ({ id: l.id })) } },
    include: { labels: true },
  });
  return NextResponse.json({ email });
}
