import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.mailbox.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  if (body?.isDefault !== true) {
    return NextResponse.json({ error: "isDefault must be true" }, { status: 400 });
  }

  const [, mailbox] = await prisma.$transaction([
    prisma.mailbox.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.mailbox.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return NextResponse.json({ mailbox });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.mailbox.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const count = await prisma.mailbox.count({ where: { userId } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "can't delete your only mailbox" },
      { status: 400 }
    );
  }

  // Cascades to delete every email in this mailbox (schema-level onDelete:
  // Cascade) — the client confirms with the user before calling this.
  await prisma.mailbox.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
