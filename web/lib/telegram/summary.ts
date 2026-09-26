import { prisma } from "@/lib/db";
import { folderWhere } from "@/lib/mail-folders";
import { getHolidays } from "@/lib/holidays/service";
import type { Holiday } from "@/lib/holidays/types";

export type TaskSummary = {
  id: string;
  title: string;
  dueAt: Date | null;
  dueHasTime: boolean;
};

export type TaskBuckets = { overdue: TaskSummary[]; today: TaskSummary[]; upcoming: TaskSummary[] };

function byDueDate(a: TaskSummary, b: TaskSummary): number {
  if (a.dueAt === null) return b.dueAt === null ? 0 : 1;
  if (b.dueAt === null) return -1;
  return a.dueAt.getTime() - b.dueAt.getTime();
}

// A 3-way partition (overdue / today / upcoming shown together) — different
// from task-store's client-side SmartView filters, which are two overlapping
// views selected one at a time, so it isn't reused directly from there.
// Pure and exported separately from the Prisma fetch below so it's
// unit-testable with fixed fixtures, matching task-store's own
// filteredTasks/viewFilteredTasks split.
export function bucketTasks(tasks: TaskSummary[], now: Date): TaskBuckets {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const buckets: TaskBuckets = { overdue: [], today: [], upcoming: [] };
  for (const task of tasks) {
    if (task.dueAt === null) continue;
    if (task.dueAt < startOfToday) buckets.overdue.push(task);
    else if (task.dueAt < startOfTomorrow) buckets.today.push(task);
    else buckets.upcoming.push(task);
  }
  buckets.overdue.sort(byDueDate);
  buckets.today.sort(byDueDate);
  buckets.upcoming.sort(byDueDate);
  return buckets;
}

export async function getTaskBuckets(userId: string, now = new Date()): Promise<TaskBuckets> {
  const tasks = await prisma.task.findMany({
    where: { userId, completed: false },
    select: { id: true, title: true, dueAt: true, dueHasTime: true },
  });
  return bucketTasks(tasks, now);
}

export async function getDefaultMailbox(userId: string) {
  return (
    (await prisma.mailbox.findFirst({ where: { userId, isDefault: true } })) ??
    (await prisma.mailbox.findFirst({ where: { userId } }))
  );
}

export type EmailSummary = {
  unreadCount: number;
  importantEmails: { id: string; from: string; subject: string }[];
};

// Deterministic counts only — no AI-invented "needs a reply" classification,
// since there's no thread/reply-tracking model to ground that in.
export async function getEmailSummary(userId: string): Promise<EmailSummary> {
  const mailbox = await getDefaultMailbox(userId);
  if (!mailbox) return { unreadCount: 0, importantEmails: [] };

  const [unreadCount, important] = await Promise.all([
    prisma.email.count({ where: { mailboxId: mailbox.id, ...folderWhere("inbox"), read: false } }),
    prisma.email.findMany({
      where: { mailboxId: mailbox.id, ...folderWhere("important") },
      select: { id: true, from: true, subject: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return { unreadCount, importantEmails: important };
}

export async function getTodayHolidays(userId: string, now = new Date()): Promise<Holiday[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { holidayCountry: true, holidayRegion: true } });
  if (!user?.holidayCountry) return [];
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const holidays = await getHolidays(user.holidayCountry, now.getFullYear(), user.holidayRegion ?? undefined);
  return holidays.filter((h) => h.date === todayIso);
}

export type DailySummary = {
  tasks: TaskBuckets;
  email: EmailSummary;
  holidays: Holiday[];
};

export async function getDailySummary(userId: string, now = new Date()): Promise<DailySummary> {
  const [tasks, email, holidays] = await Promise.all([
    getTaskBuckets(userId, now),
    getEmailSummary(userId),
    getTodayHolidays(userId, now),
  ]);
  return { tasks, email, holidays };
}
