import { prisma } from "@/lib/db";
import { PromiseDirection, PromiseStatus, type Prisma, type Promise as PromiseRecord } from "../generated/prisma/client";

export const PROMISE_INCLUDE = {
  sourceEmail: { select: { id: true, from: true, subject: true } },
  relatedTask: { select: { id: true, title: true, completed: true, dueAt: true } },
} as const;

type PromiseWithRelations = Prisma.PromiseGetPayload<{ include: typeof PROMISE_INCLUDE }>;

export type DerivedPromiseStatus = "ACTIVE" | "DUE_SOON" | "OVERDUE" | "FULFILLED" | "DISMISSED";
export type PromiseWithDerivedStatus = PromiseWithRelations & { derivedStatus: DerivedPromiseStatus };

const DUE_SOON_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// Pure — unit-tested directly. Only ACTIVE/FULFILLED/DISMISSED are ever
// stored (see schema comment); DUE_SOON/OVERDUE are always computed from
// status+dueAt here so they can never go stale relative to the deadline.
export function derivePromiseStatus(
  promise: Pick<PromiseRecord, "status" | "dueAt">,
  now: Date = new Date()
): DerivedPromiseStatus {
  if (promise.status !== "ACTIVE") return promise.status;
  if (!promise.dueAt) return "ACTIVE";
  const due = new Date(promise.dueAt);
  if (due < now) return "OVERDUE";
  if (due.getTime() - now.getTime() <= DUE_SOON_WINDOW_MS) return "DUE_SOON";
  return "ACTIVE";
}

function withDerivedStatus(p: PromiseWithRelations, now: Date): PromiseWithDerivedStatus {
  return { ...p, derivedStatus: derivePromiseStatus(p, now) };
}

export async function getPromisesForUser(userId: string, now: Date = new Date()): Promise<PromiseWithDerivedStatus[]> {
  const rows = await prisma.promise.findMany({
    where: { userId },
    include: PROMISE_INCLUDE,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => withDerivedStatus(r, now));
}

// `status` accepts "all" | "active" | "fulfilled" | "dismissed" — "active"
// maps to every derived status that isn't a terminal one (ACTIVE, DUE_SOON,
// OVERDUE all still need action), matching how PromiseList's "all" filter
// already treats them as one group.
export async function searchPromisesForUser(
  userId: string,
  opts: { query?: string; status?: string } = {}
): Promise<PromiseWithDerivedStatus[]> {
  const all = await getPromisesForUser(userId);
  let filtered = all;

  if (opts.query) {
    const q = opts.query.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.commitment.toLowerCase().includes(q) ||
        (p.personName?.toLowerCase().includes(q) ?? false) ||
        (p.personEmail?.toLowerCase().includes(q) ?? false)
    );
  }

  if (opts.status && opts.status !== "all") {
    const wantActive = opts.status === "active";
    filtered = filtered.filter((p) =>
      wantActive
        ? p.derivedStatus === "ACTIVE" || p.derivedStatus === "DUE_SOON" || p.derivedStatus === "OVERDUE"
        : p.derivedStatus === opts.status!.toUpperCase()
    );
  }

  return filtered;
}

export async function loadOwnedPromise(
  id: string,
  userId: string,
  now: Date = new Date()
): Promise<PromiseWithDerivedStatus | null> {
  const row = await prisma.promise.findFirst({ where: { id, userId }, include: PROMISE_INCLUDE });
  return row ? withDerivedStatus(row, now) : null;
}

export async function ownsPromise(id: string, userId: string): Promise<boolean> {
  const count = await prisma.promise.count({ where: { id, userId } });
  return count > 0;
}

// Used before running AI detection on an email — once a promise has been
// tracked (or explicitly ignored — see PossiblePromiseCard's own dismissal
// list) for a given email, don't re-detect it every time the email reopens.
export async function hasPromiseForEmail(userId: string, sourceEmailId: string): Promise<boolean> {
  const count = await prisma.promise.count({ where: { userId, sourceEmailId } });
  return count > 0;
}

const DIRECTIONS = new Set<string>(Object.values(PromiseDirection));

export type CreatePromiseInput = {
  direction: string;
  personName?: string | null;
  personEmail?: string | null;
  commitment: string;
  dueAt?: string | null;
  confidence?: number | null;
  sourceEmailId?: string | null;
};

export type PromiseResult =
  | { ok: true; promise: PromiseWithRelations }
  | { ok: false; error: string; status: number };

// Shared by the HTTP route (app/api/promises) and PossiblePromiseCard's
// "Track Promise" confirmation, so email-ownership checks live in one place.
export async function createPromiseForUser(userId: string, input: CreatePromiseInput): Promise<PromiseResult> {
  const commitment = input.commitment.trim();
  if (!commitment) return { ok: false, error: "commitment is required", status: 400 };
  if (!DIRECTIONS.has(input.direction)) {
    return { ok: false, error: "direction must be INCOMING or OUTGOING", status: 400 };
  }

  let sourceEmailId: string | null = null;
  if (input.sourceEmailId) {
    const email = await prisma.email.findFirst({ where: { id: input.sourceEmailId, mailbox: { userId } } });
    if (!email) return { ok: false, error: "email not found", status: 404 };
    sourceEmailId = email.id;
  }

  const promise = await prisma.promise.create({
    data: {
      userId,
      direction: input.direction as PromiseDirection,
      personName: input.personName?.trim() || null,
      personEmail: input.personEmail?.trim() || null,
      commitment,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      confidence: input.confidence ?? null,
      sourceEmailId,
    },
    include: PROMISE_INCLUDE,
  });

  return { ok: true, promise };
}

export type UpdatePromiseInput = Partial<{
  commitment: string;
  personName: string | null;
  personEmail: string | null;
  dueAt: string | null;
  status: string;
}>;

// Generic edits + the "Dismiss" action (status: DISMISSED) go through here;
// "Mark Fulfilled" has its own named export below since it's the primary
// promise-detail CTA and sets fulfilledAt alongside the status.
export async function updatePromiseForUser(id: string, userId: string, input: UpdatePromiseInput): Promise<PromiseResult> {
  const existing = await prisma.promise.findFirst({ where: { id, userId } });
  if (!existing) return { ok: false, error: "not found", status: 404 };

  const data: Prisma.PromiseUpdateInput = {};
  if (input.commitment !== undefined) {
    const trimmed = input.commitment.trim();
    if (!trimmed) return { ok: false, error: "commitment cannot be empty", status: 400 };
    data.commitment = trimmed;
  }
  if (input.personName !== undefined) data.personName = input.personName?.trim() || null;
  if (input.personEmail !== undefined) data.personEmail = input.personEmail?.trim() || null;
  if (input.dueAt !== undefined) data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (input.status !== undefined) {
    if (!Object.values(PromiseStatus).includes(input.status as PromiseStatus)) {
      return { ok: false, error: "invalid status", status: 400 };
    }
    data.status = input.status as PromiseStatus;
    if (input.status === "DISMISSED") data.dismissedAt = new Date();
    if (input.status === "FULFILLED") data.fulfilledAt = new Date();
  }

  const promise = await prisma.promise.update({ where: { id }, data, include: PROMISE_INCLUDE });
  return { ok: true, promise };
}

export async function fulfillPromiseForUser(id: string, userId: string): Promise<PromiseResult> {
  return updatePromiseForUser(id, userId, { status: "FULFILLED" });
}

export async function linkPromiseToTask(id: string, userId: string, taskId: string): Promise<boolean> {
  const result = await prisma.promise.updateMany({ where: { id, userId }, data: { relatedTaskId: taskId } });
  return result.count > 0;
}
