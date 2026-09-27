import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeNextOccurrence } from "@/lib/recurrence";
import { sendNotification } from "@/lib/notifications";

// Hit by an external scheduler every few minutes (see README > recurring
// task reminders setup). GET, not POST, since most free cron services
// (cron-job.org, etc.) only issue GET requests.
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") ?? req.headers.get("X-Cron-Secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.task.findMany({
    where: {
      recurrenceType: { not: null },
      reminderEnabled: true,
      OR: [{ nextOccurrenceAt: { lte: now } }, { snoozedUntil: { lte: now } }],
    },
    select: {
      id: true,
      userId: true,
      title: true,
      recurrenceType: true,
      recurrenceDaysOfWeek: true,
      recurrenceDayOfMonth: true,
      reminderTime: true,
      nextOccurrenceAt: true,
      snoozedUntil: true,
    },
  });

  let delivered = 0;
  for (const task of due) {
    const user = await prisma.user.findUnique({ where: { id: task.userId }, select: { timezone: true } });
    if (!user?.timezone) continue; // can't compute the next occurrence safely without one — never assume UTC

    const isSnoozeFire = task.snoozedUntil !== null && task.snoozedUntil <= now;
    const occurrenceAt = isSnoozeFire ? task.snoozedUntil! : task.nextOccurrenceAt!;

    // Every button carries this exact occurrence's own timestamp, so Done/
    // Skip/Snooze always act on the slot they were shown for — independent
    // of whatever nextOccurrenceAt has advanced to by the time they're
    // pressed (see lib/recurrence.test.ts's missed-reminder case for why
    // that separation matters). Epoch seconds, not a full ISO string —
    // Telegram's callback_data caps at 64 bytes, and an ISO string's own
    // colons would also break the existing `data.split(":")` parsing.
    const occurrenceEpochSeconds = Math.floor(occurrenceAt.getTime() / 1000);
    const sent = await sendNotification({
      userId: task.userId,
      title: `🔔 ${task.title}`,
      body: "It's time.",
      buttons: [
        [
          { label: "Done", callbackData: `td:${task.id}:${occurrenceEpochSeconds}` },
          { label: "Snooze 10m", callbackData: `tsn:${task.id}:${occurrenceEpochSeconds}` },
          { label: "Skip Today", callbackData: `tsk:${task.id}:${occurrenceEpochSeconds}` },
        ],
      ],
    });
    if (sent) delivered++;

    if (isSnoozeFire) {
      // A snooze is a one-off side channel — firing it never touches the
      // real recurrence schedule, just clears the flag that triggered it.
      await prisma.task.update({ where: { id: task.id }, data: { snoozedUntil: null } });
    } else {
      // Advances immediately after attempting delivery, whether or not the
      // user has a channel connected — this, not a "was it sent" flag, is
      // what keeps an unreachable/unacknowledged reminder from going dead.
      const next = computeNextOccurrence(
        {
          recurrenceType: task.recurrenceType!,
          recurrenceDaysOfWeek: task.recurrenceDaysOfWeek,
          recurrenceDayOfMonth: task.recurrenceDayOfMonth,
          reminderTime: task.reminderTime ?? "09:00",
        },
        user.timezone,
        occurrenceAt
      );
      await prisma.task.update({ where: { id: task.id }, data: { nextOccurrenceAt: next, dueAt: next } });
    }
  }

  return NextResponse.json({ checked: due.length, delivered });
}
