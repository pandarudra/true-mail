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
  const existing = await prisma.taskList.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json();
  const data: { name?: string; color?: string } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.color === "string" && body.color) data.color = body.color;
  const taskList = await prisma.taskList.update({ where: { id }, data });
  return NextResponse.json({ taskList });
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
  const existing = await prisma.taskList.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.isDefault) {
    return NextResponse.json({ error: "can't delete the default list" }, { status: 400 });
  }
  const defaultList = await prisma.taskList.findFirst({ where: { userId, isDefault: true } });
  await prisma.$transaction([
    prisma.task.updateMany({ where: { listId: id }, data: { listId: defaultList!.id } }),
    prisma.taskList.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
