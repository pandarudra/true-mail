import { prisma } from "@/lib/db";

export const TASK_INCLUDE = {
  subtasks: { orderBy: { position: "asc" as const } },
  sourceEmail: { select: { id: true, from: true, subject: true } },
} as const;

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
