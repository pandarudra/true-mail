import { prisma } from "@/lib/db";
import { Priority, type Prisma, type RecurrenceType } from "../generated/prisma/client";
import { computeNextOccurrence, defaultRecurrenceFields } from "@/lib/recurrence";

const PRIORITIES = new Set<string>(Object.values(Priority));
const RECURRENCE_TYPES = new Set<string>(["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY"]);

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

export type RecurrenceInput = {
  recurrenceType: string;
  recurrenceDaysOfWeek?: number[];
  recurrenceDayOfMonth?: number | null;
  recurrenceEndAt?: string | null;
  reminderEnabled?: boolean;
  reminderTime?: string; // "HH:mm", defaults to "09:00" if omitted
};

export type CreateTaskInput = {
  title: string;
  listId?: string;
  description?: string | null;
  dueAt?: string | null;
  dueHasTime?: boolean;
  priority?: string;
  sourceEmailId?: string | null;
  recurrence?: RecurrenceInput | null;
};

export type CreateTaskResult =
  | { ok: true; task: TaskWithRelations }
  | { ok: false; error: string; status: number };

export type RecurrenceData = {
  recurrenceType: RecurrenceType;
  recurrenceDaysOfWeek: number[];
  recurrenceDayOfMonth: number | null;
  recurrenceEndAt: Date | null;
  reminderEnabled: boolean;
  reminderTime: string;
  nextOccurrenceAt: Date;
};

export type RecurrenceResult = { ok: true; data: RecurrenceData } | { ok: false; error: string; status: number };

// Shared by task creation (createTaskForUser) and editing an existing task's
// recurrence (the PATCH route) — resolving "what does this recurrence input
// mean, starting from `after`" is the same computation either way, just
// applied to a fresh task vs. one already in the database.
export async function resolveRecurrence(userId: string, input: RecurrenceInput, after: Date): Promise<RecurrenceResult> {
  if (!RECURRENCE_TYPES.has(input.recurrenceType)) {
    return { ok: false, error: "invalid recurrence type", status: 400 };
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  if (!user?.timezone) {
    return { ok: false, error: "Set your timezone in Settings before creating a recurring task", status: 400 };
  }
  const recurrenceType = input.recurrenceType as RecurrenceType;
  const reminderTime = input.reminderTime ?? "09:00";
  const defaults = defaultRecurrenceFields(
    recurrenceType,
    input.recurrenceDaysOfWeek ?? [],
    input.recurrenceDayOfMonth ?? null,
    user.timezone,
    after
  );
  const nextOccurrenceAt = computeNextOccurrence({ recurrenceType, ...defaults, reminderTime }, user.timezone, after);
  return {
    ok: true,
    data: {
      recurrenceType,
      recurrenceDaysOfWeek: defaults.recurrenceDaysOfWeek,
      recurrenceDayOfMonth: defaults.recurrenceDayOfMonth,
      recurrenceEndAt: input.recurrenceEndAt ? new Date(input.recurrenceEndAt) : null,
      reminderEnabled: !!input.reminderEnabled,
      reminderTime,
      nextOccurrenceAt,
    },
  };
}

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

  let recurrenceData: RecurrenceData | null = null;
  if (input.recurrence) {
    const resolved = await resolveRecurrence(userId, input.recurrence, new Date());
    if (!resolved.ok) return resolved;
    recurrenceData = resolved.data;
  }

  const { _max } = await prisma.task.aggregate({ where: { listId }, _max: { position: true } });

  const task = await prisma.task.create({
    data: {
      userId,
      listId,
      title,
      description: input.description ?? null,
      // A recurring task's due date is its next occurrence, always with a
      // time attached — the one-off dueAt/dueHasTime inputs are ignored
      // when recurrence is set, rather than left to silently disagree.
      dueAt: recurrenceData ? recurrenceData.nextOccurrenceAt : input.dueAt ? new Date(input.dueAt) : null,
      dueHasTime: recurrenceData ? true : !!input.dueHasTime,
      priority: PRIORITIES.has(input.priority ?? "") ? (input.priority as Priority) : Priority.NORMAL,
      sourceEmailId,
      position: (_max.position ?? -1) + 1,
      ...recurrenceData,
    },
    include: TASK_INCLUDE,
  });

  return { ok: true, task };
}

// The shared "mark this occurrence handled, advance to the next one" action
// — used by the web checkbox/swipe-to-complete, and by Telegram's Done/Skip
// buttons. A recurring task never actually goes to `completed: true` (it's
// a rolling series, not a one-off); it just rolls its due date forward.
// Callers should route here instead of a plain completed-flag update
// whenever `task.recurrenceType` is set.
export async function completeRecurringOccurrence(taskId: string, userId: string): Promise<CreateTaskResult> {
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!existing) return { ok: false, error: "not found", status: 404 };
  if (!existing.recurrenceType) return { ok: false, error: "not a recurring task", status: 400 };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  if (!user?.timezone) {
    return { ok: false, error: "Set your timezone in Settings first", status: 400 };
  }

  // Advances from the task's own last-known occurrence, not from "now" —
  // this is what keeps a missed reminder alive instead of going dead (see
  // lib/recurrence.test.ts's "long-missed occurrence" case for why).
  const reference = existing.nextOccurrenceAt ?? new Date();
  const next = computeNextOccurrence(
    {
      recurrenceType: existing.recurrenceType,
      recurrenceDaysOfWeek: existing.recurrenceDaysOfWeek,
      recurrenceDayOfMonth: existing.recurrenceDayOfMonth,
      reminderTime: existing.reminderTime ?? "09:00",
    },
    user.timezone,
    reference
  );

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { dueAt: next, dueHasTime: true, nextOccurrenceAt: next, completed: false, snoozedUntil: null },
    include: TASK_INCLUDE,
  });

  return { ok: true, task };
}
