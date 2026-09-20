import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getOrCreateTaskLists } from "@/lib/tasks";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const taskLists = await getOrCreateTaskLists(userId);
  return NextResponse.json({ taskLists });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name: string | undefined = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const existing = await prisma.taskList.findUnique({ where: { userId_name: { userId, name } } });
  if (existing) {
    return NextResponse.json({ error: "a list with that name already exists" }, { status: 409 });
  }
  const taskList = await prisma.taskList.create({
    data: { userId, name, color: body?.color || undefined },
  });
  return NextResponse.json({ taskList });
}
