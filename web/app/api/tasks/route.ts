import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { createTaskForUser, TASK_INCLUDE } from "@/lib/tasks";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: [{ listId: "asc" }, { position: "asc" }],
    include: TASK_INCLUDE,
  });
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const title: string | undefined = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const result = await createTaskForUser(userId, {
    title,
    listId: typeof body?.listId === "string" ? body.listId : undefined,
    description: typeof body?.description === "string" ? body.description : null,
    dueAt: body?.dueAt ?? null,
    dueHasTime: !!body?.dueHasTime,
    priority: body?.priority,
    sourceEmailId: typeof body?.sourceEmailId === "string" ? body.sourceEmailId : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ task: result.task });
}
