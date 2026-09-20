import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { loadOwnedTask, TASK_INCLUDE } from "@/lib/tasks";
import type { Prisma } from "@/generated/prisma/client";

const PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedTask(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  if ("description" in body) data.description = typeof body.description === "string" ? body.description : null;
  if ("dueAt" in body) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (typeof body?.dueHasTime === "boolean") data.dueHasTime = body.dueHasTime;
  if (PRIORITIES.has(body?.priority)) data.priority = body.priority;
  if (typeof body?.completed === "boolean") {
    data.completed = body.completed;
    data.completedAt = body.completed ? new Date() : null;
  }

  let listId = existing.listId;
  if (typeof body?.listId === "string" && body.listId !== existing.listId) {
    const list = await prisma.taskList.findFirst({ where: { id: body.listId, userId } });
    if (!list) {
      return NextResponse.json({ error: "list not found" }, { status: 404 });
    }
    listId = list.id;
    data.listId = listId;
  }

  // Reordering renumbers only the destination list. A cross-list move can
  // leave a position gap in the *old* list (e.g. 0, 2, 3) — harmless, since
  // ordering only relies on relative order, not contiguous integers.
  if (typeof body?.position === "number") {
    const siblings = await prisma.task.findMany({
      where: { listId, userId, NOT: { id } },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    const ids = siblings.map((t) => t.id);
    const index = Math.max(0, Math.min(body.position, ids.length));
    ids.splice(index, 0, id);
    await prisma.$transaction(
      ids.map((taskId, i) => prisma.task.update({ where: { id: taskId }, data: { position: i } }))
    );
  }

  const task = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });
  return NextResponse.json({ task });
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
  const existing = await loadOwnedTask(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
