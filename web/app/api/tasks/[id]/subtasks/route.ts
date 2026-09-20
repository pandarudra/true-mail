import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { ownsTask, TASK_INCLUDE } from "@/lib/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await ownsTask(id, userId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json();
  const title: string | undefined = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const { _max } = await prisma.subtask.aggregate({ where: { taskId: id }, _max: { position: true } });
  await prisma.subtask.create({ data: { taskId: id, title, position: (_max.position ?? -1) + 1 } });
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return NextResponse.json({ task });
}
