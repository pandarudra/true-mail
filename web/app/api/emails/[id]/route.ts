import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

async function loadOwnedEmail(id: string, userId: string) {
  return prisma.email.findFirst({
    where: { id, mailbox: { userId } },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const email = await loadOwnedEmail(id, userId);
  if (!email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ email });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedEmail(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: { read?: boolean; starred?: boolean } = {};
  if (typeof body?.read === "boolean") data.read = body.read;
  if (typeof body?.starred === "boolean") data.starred = body.starred;

  const email = await prisma.email.update({ where: { id }, data });
  return NextResponse.json({ email });
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
  const existing = await loadOwnedEmail(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.email.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
