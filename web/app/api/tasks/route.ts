import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getOrCreateDefaultTaskList, TASK_INCLUDE } from "@/lib/tasks";

const PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

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

  let listId: string;
  if (typeof body?.listId === "string") {
    const list = await prisma.taskList.findFirst({ where: { id: body.listId, userId } });
    if (!list) {
      return NextResponse.json({ error: "list not found" }, { status: 404 });
    }
    listId = list.id;
  } else {
    listId = (await getOrCreateDefaultTaskList(userId)).id;
  }

  let sourceEmailId: string | null = null;
  if (typeof body?.sourceEmailId === "string") {
    const email = await prisma.email.findFirst({ where: { id: body.sourceEmailId, mailbox: { userId } } });
    if (!email) {
      return NextResponse.json({ error: "email not found" }, { status: 404 });
    }
    sourceEmailId = email.id;
  }

  const { _max } = await prisma.task.aggregate({ where: { listId }, _max: { position: true } });

  const task = await prisma.task.create({
    data: {
      userId,
      listId,
      title,
      description: typeof body?.description === "string" ? body.description : null,
      dueAt: body?.dueAt ? new Date(body.dueAt) : null,
      dueHasTime: !!body?.dueHasTime,
      priority: PRIORITIES.has(body?.priority) ? body.priority : "NORMAL",
      sourceEmailId,
      position: (_max.position ?? -1) + 1,
    },
    include: TASK_INCLUDE,
  });
  return NextResponse.json({ task });
}
