import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { loadOwnedPromise, linkPromiseToTask } from "@/lib/promises";
import { createTaskForUser } from "@/lib/tasks";

// "Promise → Task" (spec §10) and "Promise → Calendar" (§11) are the same
// action here — this app's calendar already shows tasks with a `dueAt`
// (confirmed earlier: no separate Events model), so creating a task with
// the promise's deadline covers both.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const promise = await loadOwnedPromise(id, userId);
  if (!promise) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (promise.relatedTaskId) {
    return NextResponse.json({ error: "already linked to a task" }, { status: 409 });
  }

  const result = await createTaskForUser(userId, {
    title: promise.commitment,
    dueAt: promise.dueAt?.toISOString() ?? null,
    sourceEmailId: promise.sourceEmailId ?? undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await linkPromiseToTask(id, userId, result.task.id);
  return NextResponse.json({ task: result.task });
}
