import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { TASK_INCLUDE } from "@/lib/tasks";

async function loadOwnedSubtask(taskId: string, subtaskId: string, userId: string) {
  return prisma.subtask.findFirst({ where: { id: subtaskId, taskId, task: { userId } } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, subtaskId } = await params;
  const existing = await loadOwnedSubtask(id, subtaskId, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json();
  const data: { title?: string; completed?: boolean } = {};
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body?.completed === "boolean") data.completed = body.completed;
  await prisma.subtask.update({ where: { id: subtaskId }, data });
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return NextResponse.json({ task });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, subtaskId } = await params;
  const existing = await loadOwnedSubtask(id, subtaskId, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.subtask.delete({ where: { id: subtaskId } });
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return NextResponse.json({ task });
}
