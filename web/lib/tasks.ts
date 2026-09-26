import { prisma } from "@/lib/db";
import { Priority, type Prisma } from "../generated/prisma/client";

const PRIORITIES = new Set<string>(Object.values(Priority));

export const TASK_INCLUDE = {
  subtasks: { orderBy: { position: "asc" as const } },
  sourceEmail: { select: { id: true, from: true, subject: true } },
} as const;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

export async function loadOwnedTask(id: string, userId: string) {
  return prisma.task.findFirst({ where: { id, userId }, include: TASK_INCLUDE });
}

export async function ownsTask(id: string, userId: string): Promise<boolean> {
  const count = await prisma.task.count({ where: { id, userId } });
  return count > 0;
}

export async function getOrCreateDefaultTaskList(userId: string) {
  const existing = await prisma.taskList.findFirst({ where: { userId, isDefault: true } });
  if (existing) return existing;
  return prisma.taskList.create({ data: { userId, name: "Inbox", isDefault: true } });
}

export async function getOrCreateTaskLists(userId: string) {
  const lists = await prisma.taskList.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (lists.length > 0) return lists;
  return [await getOrCreateDefaultTaskList(userId)];
}

export type CreateTaskInput = {
  title: string;
  listId?: string;
  description?: string | null;
  dueAt?: string | null;
  dueHasTime?: boolean;
  priority?: string;
  sourceEmailId?: string | null;
};

export type CreateTaskResult =
  | { ok: true; task: TaskWithRelations }
  | { ok: false; error: string; status: number };

// Shared by the HTTP route (app/api/tasks) and the Telegram integration, so
// list/email ownership checks and defaults live in exactly one place.
export async function createTaskForUser(userId: string, input: CreateTaskInput): Promise<CreateTaskResult> {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "title is required", status: 400 };
  }

  let listId: string;
  if (input.listId) {
    const list = await prisma.taskList.findFirst({ where: { id: input.listId, userId } });
    if (!list) return { ok: false, error: "list not found", status: 404 };
    listId = list.id;
  } else {
    listId = (await getOrCreateDefaultTaskList(userId)).id;
  }

  let sourceEmailId: string | null = null;
  if (input.sourceEmailId) {
    const email = await prisma.email.findFirst({ where: { id: input.sourceEmailId, mailbox: { userId } } });
    if (!email) return { ok: false, error: "email not found", status: 404 };
    sourceEmailId = email.id;
  }

  const { _max } = await prisma.task.aggregate({ where: { listId }, _max: { position: true } });

  const task = await prisma.task.create({
    data: {
      userId,
      listId,
      title,
      description: input.description ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      dueHasTime: !!input.dueHasTime,
      priority: PRIORITIES.has(input.priority ?? "") ? (input.priority as Priority) : Priority.NORMAL,
      sourceEmailId,
      position: (_max.position ?? -1) + 1,
    },
    include: TASK_INCLUDE,
  });

  return { ok: true, task };
}
