import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { createTaskForUser, getTasksForUser } from "@/lib/tasks";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tasks = await getTasksForUser(userId);
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
    recurrence: body?.recurrence
      ? {
          recurrenceType: body.recurrence.recurrenceType,
          recurrenceDaysOfWeek: Array.isArray(body.recurrence.recurrenceDaysOfWeek)
            ? body.recurrence.recurrenceDaysOfWeek
            : undefined,
          recurrenceDayOfMonth:
            typeof body.recurrence.recurrenceDayOfMonth === "number" ? body.recurrence.recurrenceDayOfMonth : null,
          recurrenceEndAt: body.recurrence.recurrenceEndAt ?? null,
          reminderEnabled: !!body.recurrence.reminderEnabled,
          reminderTime: typeof body.recurrence.reminderTime === "string" ? body.recurrence.reminderTime : undefined,
        }
      : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ task: result.task });
}
