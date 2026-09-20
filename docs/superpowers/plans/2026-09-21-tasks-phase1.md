# Tasks Feature (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone Tasks feature inside TrueMail — task CRUD with lists, due dates, priority, subtasks, drag-and-drop ordering, smart views, plus an "Add to Tasks" bridge from an open email.

**Architecture:** Three new Prisma models (`TaskList`, `Task`, `Subtask`) scoped by `userId`, a set of REST routes under `app/api/task-lists` and `app/api/tasks` following the app's existing `getUserId` + ownership-scoped-query convention, a Zustand store (`lib/stores/task-store.ts`) mirroring `inbox-store.ts`, and a new `/tasks` page reusing the app's existing `TopBar`/`Sidebar`/`Dialog`/`Button`/`Input`/`Select` primitives.

**Tech Stack:** Next.js 16 (App Router, async `params`), Prisma 7 (`prisma-client` generator), PostgreSQL, Zustand 5, Tailwind v4, Phosphor icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-tasks-phase1-design.md`

## Global Constraints

- Every API route: `getUserId(req.headers)` → 401 if none; every query scoped by `userId` (directly on `Task`/`TaskList`, or via `task: { userId }` for `Subtask`) → 404 if not found/not owned. Copied verbatim from the existing convention in `app/api/labels/*`.
- No new npm dependencies. Drag-and-drop uses native HTML5 DnD; date/time inputs use native `<input type="date">` / `<input type="time">`.
- No recurrence, no reminders/notifications, no attachments/links on tasks, no nested lists, no universal Quick Add — all explicitly out of scope per the spec's §1 and §7.
- After the Prisma migration in Task 1, **restart the Next.js dev server** — this repo's Prisma client requires a dev-server restart to pick up schema changes.
- Icons are Phosphor (`@phosphor-icons/react`) only, matching every existing icon in the app.

---

## Task 1: Prisma schema — TaskList, Task, Subtask

**Files:**
- Modify: `web/prisma/schema.prisma`

**Interfaces:**
- Produces: `TaskList { id, userId, name, color, isDefault, createdAt }`, `Task { id, userId, listId, title, description, dueAt, dueHasTime, priority: "LOW"|"NORMAL"|"HIGH"|"URGENT", completed, completedAt, position, sourceEmailId, createdAt, updatedAt }`, `Subtask { id, taskId, title, completed, position }`. Every later task's Prisma calls assume these exact field names.

- [ ] **Step 1: Add the enum and three models**

Add to `web/prisma/schema.prisma`, after the `Label` model:

```prisma
enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
}

model TaskList {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  color     String   @default("#6b7280")
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  tasks     Task[]

  @@unique([userId, name])
}

model Task {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  listId        String
  list          TaskList  @relation(fields: [listId], references: [id], onDelete: Cascade)
  title         String
  description   String?
  dueAt         DateTime?
  dueHasTime    Boolean   @default(false)
  priority      Priority  @default(NORMAL)
  completed     Boolean   @default(false)
  completedAt   DateTime?
  position      Int       @default(0)
  sourceEmailId String?
  sourceEmail   Email?    @relation(fields: [sourceEmailId], references: [id], onDelete: SetNull)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  subtasks      Subtask[]
}

model Subtask {
  id        String  @id @default(uuid())
  taskId    String
  task      Task    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  title     String
  completed Boolean @default(false)
  position  Int     @default(0)
}
```

- [ ] **Step 2: Wire the inverse relations**

In the `User` model, add two fields alongside the existing `labels Label[]`:

```prisma
  taskLists TaskList[]
  tasks     Task[]
```

In the `Email` model, add one field alongside `attachments Attachment[]`:

```prisma
  tasks       Task[]
```

- [ ] **Step 3: Run the migration**

```bash
cd web && npx prisma migrate dev --name add_tasks
```

Expected: migration applies cleanly, Prisma client regenerates (via the schema's own postinstall hook path), no errors.

- [ ] **Step 4: Restart the dev server**

If `npm run dev` is running, stop and restart it now — this repo's Prisma client needs a fresh process to see the new models (per project convention).

- [ ] **Step 5: Commit**

```bash
git add web/prisma/schema.prisma web/prisma/migrations
git commit -m "Add TaskList, Task, and Subtask models"
```

---

## Task 2: `lib/tasks.ts` — shared ownership/query helpers

**Files:**
- Create: `web/lib/tasks.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (existing).
- Produces: `TASK_INCLUDE` (Prisma include object), `loadOwnedTask(id, userId): Promise<Task | null>`, `ownsTask(id, userId): Promise<boolean>`, `getOrCreateDefaultTaskList(userId): Promise<TaskList>`, `getOrCreateTaskLists(userId): Promise<TaskList[]>` — every route task below imports from here.

- [ ] **Step 1: Write the helpers**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/tasks.ts
git commit -m "Add shared task ownership/query helpers"
```

---

## Task 3: `/api/task-lists` routes

**Files:**
- Create: `web/app/api/task-lists/route.ts`
- Create: `web/app/api/task-lists/[id]/route.ts`

**Interfaces:**
- Consumes: `getOrCreateTaskLists` from `@/lib/tasks` (Task 2).
- Produces: `GET /api/task-lists` → `{ taskLists }`; `POST /api/task-lists` → `{ taskList }` or 409; `PATCH /api/task-lists/[id]` → `{ taskList }`; `DELETE /api/task-lists/[id]` → `{ ok: true }` or 400 if default.

- [ ] **Step 1: Write the collection route**

`web/app/api/task-lists/route.ts`:

```ts
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
```

- [ ] **Step 2: Write the single-resource route**

`web/app/api/task-lists/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.taskList.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json();
  const data: { name?: string; color?: string } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.color === "string" && body.color) data.color = body.color;
  const taskList = await prisma.taskList.update({ where: { id }, data });
  return NextResponse.json({ taskList });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.taskList.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.isDefault) {
    return NextResponse.json({ error: "can't delete the default list" }, { status: 400 });
  }
  const defaultList = await prisma.taskList.findFirst({ where: { userId, isDefault: true } });
  await prisma.$transaction([
    prisma.task.updateMany({ where: { listId: id }, data: { listId: defaultList!.id } }),
    prisma.taskList.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify manually**

With the dev server running and an authenticated browser session's cookie copied into these calls (or run through the browser devtools console on any `/inbox`-loaded page, where cookies are automatic):

```bash
curl -s http://localhost:3000/api/task-lists -H "Cookie: <your session cookie>" | python3 -m json.tool
```

Expected: `{"taskLists": [{"name": "Inbox", "isDefault": true, ...}]}` on first call (auto-created).

- [ ] **Step 4: Commit**

```bash
git add web/app/api/task-lists
git commit -m "Add task-lists API routes"
```

---

## Task 4: `/api/tasks` routes

**Files:**
- Create: `web/app/api/tasks/route.ts`
- Create: `web/app/api/tasks/[id]/route.ts`

**Interfaces:**
- Consumes: `TASK_INCLUDE`, `loadOwnedTask`, `getOrCreateDefaultTaskList` from `@/lib/tasks` (Task 2).
- Produces: `GET /api/tasks` → `{ tasks }` (all, unfiltered, with `subtasks` + `sourceEmail`); `POST /api/tasks` → `{ task }`; `PATCH /api/tasks/[id]` (fields, complete/reopen, move/reorder) → `{ task }`; `DELETE /api/tasks/[id]` → `{ ok: true }`.

- [ ] **Step 1: Write the collection route**

`web/app/api/tasks/route.ts`:

```ts
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
```

- [ ] **Step 2: Write the single-resource route**

`web/app/api/tasks/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { loadOwnedTask, TASK_INCLUDE } from "@/lib/tasks";

const PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedTask(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: {
    title?: string;
    description?: string | null;
    dueAt?: Date | null;
    dueHasTime?: boolean;
    priority?: string;
    completed?: boolean;
    completedAt?: Date | null;
    listId?: string;
  } = {};
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  if ("description" in body) data.description = typeof body.description === "string" ? body.description : null;
  if ("dueAt" in body) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (typeof body?.dueHasTime === "boolean") data.dueHasTime = body.dueHasTime;
  if (PRIORITIES.has(body?.priority)) data.priority = body.priority;
  if (typeof body?.completed === "boolean") {
    data.completed = body.completed;
    data.completedAt = body.completed ? new Date() : null;
  }

  let listId = existing.listId;
  if (typeof body?.listId === "string" && body.listId !== existing.listId) {
    const list = await prisma.taskList.findFirst({ where: { id: body.listId, userId } });
    if (!list) {
      return NextResponse.json({ error: "list not found" }, { status: 404 });
    }
    listId = list.id;
    data.listId = listId;
  }

  // Reordering renumbers only the destination list. A cross-list move can
  // leave a position gap in the *old* list (e.g. 0, 2, 3) — harmless, since
  // ordering only relies on relative order, not contiguous integers.
  if (typeof body?.position === "number") {
    const siblings = await prisma.task.findMany({
      where: { listId, userId, NOT: { id } },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    const ids = siblings.map((t) => t.id);
    const index = Math.max(0, Math.min(body.position, ids.length));
    ids.splice(index, 0, id);
    await prisma.$transaction(
      ids.map((taskId, i) => prisma.task.update({ where: { id: taskId }, data: { position: i } }))
    );
  }

  const task = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });
  return NextResponse.json({ task });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedTask(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify manually**

```bash
curl -s -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" -H "Cookie: <your session cookie>" \
  -d '{"title":"Test task","priority":"HIGH"}' | python3 -m json.tool
```

Expected: `{"task": {"title": "Test task", "priority": "HIGH", "position": 0, "subtasks": [], ...}}`.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/tasks/route.ts "web/app/api/tasks/[id]/route.ts"
git commit -m "Add tasks API routes"
```

---

## Task 5: `/api/tasks/[id]/subtasks` routes

**Files:**
- Create: `web/app/api/tasks/[id]/subtasks/route.ts`
- Create: `web/app/api/tasks/[id]/subtasks/[subtaskId]/route.ts`

**Interfaces:**
- Consumes: `ownsTask`, `TASK_INCLUDE` from `@/lib/tasks` (Task 2).
- Produces: `POST /api/tasks/[id]/subtasks` → `{ task }` (with the new subtask appended); `PATCH`/`DELETE /api/tasks/[id]/subtasks/[subtaskId]` → `{ task }`. Every subtask mutation returns the *whole* refreshed task, so the store can replace it in place with one shape.

- [ ] **Step 1: Write the collection route**

`web/app/api/tasks/[id]/subtasks/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { ownsTask, TASK_INCLUDE } from "@/lib/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await ownsTask(id, userId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json();
  const title: string | undefined = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const { _max } = await prisma.subtask.aggregate({ where: { taskId: id }, _max: { position: true } });
  await prisma.subtask.create({ data: { taskId: id, title, position: (_max.position ?? -1) + 1 } });
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return NextResponse.json({ task });
}
```

- [ ] **Step 2: Write the single-resource route**

`web/app/api/tasks/[id]/subtasks/[subtaskId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { TASK_INCLUDE } from "@/lib/tasks";

async function loadOwnedSubtask(taskId: string, subtaskId: string, userId: string) {
  return prisma.subtask.findFirst({ where: { id: subtaskId, taskId, task: { userId } } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, subtaskId } = await params;
  const existing = await loadOwnedSubtask(id, subtaskId, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json();
  const data: { title?: string; completed?: boolean } = {};
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body?.completed === "boolean") data.completed = body.completed;
  await prisma.subtask.update({ where: { id: subtaskId }, data });
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return NextResponse.json({ task });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, subtaskId } = await params;
  const existing = await loadOwnedSubtask(id, subtaskId, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.subtask.delete({ where: { id: subtaskId } });
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return NextResponse.json({ task });
}
```

- [ ] **Step 3: Verify manually**

```bash
curl -s -X POST http://localhost:3000/api/tasks/<taskId>/subtasks \
  -H "Content-Type: application/json" -H "Cookie: <your session cookie>" \
  -d '{"title":"Sub one"}' | python3 -m json.tool
```

Expected: `{"task": {..., "subtasks": [{"title": "Sub one", "completed": false, "position": 0, ...}]}}`.

- [ ] **Step 4: Commit**

```bash
git add "web/app/api/tasks/[id]/subtasks"
git commit -m "Add subtasks API routes"
```

---

## Task 6: `lib/stores/task-store.ts` (TDD)

**Files:**
- Create: `web/lib/stores/task-store.test.ts`
- Create: `web/lib/stores/task-store.ts`

**Interfaces:**
- Consumes: `readError` from `@/lib/api-error` (existing).
- Produces: types `Priority`, `TaskList`, `Subtask`, `Task`, `SmartView`, `TaskView`, `TaskState`; `useTaskStore` (Zustand hook); pure functions `filteredTasks(state, now?)` and `reorderList(tasks, movingId, targetListId, targetPosition)`; hook `useFilteredTasks()`. Every UI component task below imports these exact names.

- [ ] **Step 1: Write the failing tests**

`web/lib/stores/task-store.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { filteredTasks, reorderList, useTaskStore, type Task } from "./task-store";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "1",
    listId: "list-1",
    title: "Task",
    description: null,
    dueAt: null,
    dueHasTime: false,
    priority: "NORMAL",
    completed: false,
    completedAt: null,
    position: 0,
    sourceEmail: null,
    subtasks: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Built from local-midnight boundaries (matching filteredTasks' own logic)
// rather than fixed UTC strings, so these fixtures aren't timezone-flaky.
const NOW = new Date("2026-09-21T12:00:00Z");
const startOfToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
const hoursFrom = (base: Date, hours: number) => new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString();

describe("filteredTasks", () => {
  it("today includes overdue and due-today tasks, excludes completed and no-due-date", () => {
    const tasks = [
      task({ id: "1", dueAt: hoursFrom(startOfToday, -24) }), // overdue (yesterday)
      task({ id: "2", dueAt: hoursFrom(startOfToday, 6) }), // due today
      task({ id: "3", dueAt: hoursFrom(startOfTomorrow, 6) }), // upcoming
      task({ id: "4", dueAt: hoursFrom(startOfToday, -24), completed: true }), // completed, excluded
      task({ id: "5", dueAt: null }), // no due date, excluded from Today
    ];
    const result = filteredTasks({ tasks, activeView: { kind: "smart", smart: "today" } }, NOW);
    expect(result.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("upcoming excludes today, overdue, and completed", () => {
    const tasks = [
      task({ id: "1", dueAt: hoursFrom(startOfToday, 6) }),
      task({ id: "2", dueAt: hoursFrom(startOfTomorrow, 6) }),
      task({ id: "3", dueAt: hoursFrom(startOfTomorrow, 30), completed: true }),
    ];
    const result = filteredTasks({ tasks, activeView: { kind: "smart", smart: "upcoming" } }, NOW);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("overdue is strictly before the start of today", () => {
    const tasks = [
      task({ id: "1", dueAt: hoursFrom(startOfToday, -0.5) }),
      task({ id: "2", dueAt: hoursFrom(startOfToday, 0) }),
    ];
    const result = filteredTasks({ tasks, activeView: { kind: "smart", smart: "overdue" } }, NOW);
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("completed returns only completed tasks", () => {
    const tasks = [task({ id: "1", completed: true }), task({ id: "2", completed: false })];
    const result = filteredTasks({ tasks, activeView: { kind: "smart", smart: "completed" } }, NOW);
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("list view returns only that list's tasks, sorted by position", () => {
    const tasks = [
      task({ id: "1", listId: "a", position: 1 }),
      task({ id: "2", listId: "b", position: 0 }),
      task({ id: "3", listId: "a", position: 0 }),
    ];
    const result = filteredTasks({ tasks, activeView: { kind: "list", listId: "a" } }, NOW);
    expect(result.map((t) => t.id)).toEqual(["3", "1"]);
  });
});

describe("reorderList", () => {
  it("reorders within the same list", () => {
    const tasks = [
      task({ id: "1", listId: "a", position: 0 }),
      task({ id: "2", listId: "a", position: 1 }),
      task({ id: "3", listId: "a", position: 2 }),
    ];
    const result = reorderList(tasks, "3", "a", 0);
    expect(
      result.filter((t) => t.listId === "a").sort((a, b) => a.position - b.position).map((t) => t.id)
    ).toEqual(["3", "1", "2"]);
  });

  it("moves a task into a different list at the given index", () => {
    const tasks = [
      task({ id: "1", listId: "a", position: 0 }),
      task({ id: "2", listId: "b", position: 0 }),
      task({ id: "3", listId: "b", position: 1 }),
    ];
    const result = reorderList(tasks, "1", "b", 1);
    const listB = result.filter((t) => t.listId === "b").sort((a, b) => a.position - b.position);
    expect(listB.map((t) => t.id)).toEqual(["2", "1", "3"]);
    expect(result.find((t) => t.id === "1")?.listId).toBe("b");
  });
});

describe("toggleComplete", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useTaskStore.setState({
      tasks: [],
      taskLists: [],
      activeView: { kind: "smart", smart: "today" },
      initialized: false,
      loading: false,
    });
  });

  it("rolls back the optimistic update when the request fails", async () => {
    useTaskStore.setState({ tasks: [task({ id: "1", completed: false })] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "boom" }) }));
    await useTaskStore.getState().toggleComplete("1", true);
    expect(useTaskStore.getState().tasks[0].completed).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd web && npx vitest run lib/stores/task-store.test.ts
```

Expected: FAIL — `./task-store` doesn't exist yet.

- [ ] **Step 3: Write the store**

`web/lib/stores/task-store.ts`:

```ts
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { readError } from "@/lib/api-error";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TaskList = { id: string; name: string; color: string; isDefault: boolean };
export type Subtask = { id: string; title: string; completed: boolean; position: number };
export type Task = {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  dueHasTime: boolean;
  priority: Priority;
  completed: boolean;
  completedAt: string | null;
  position: number;
  sourceEmail: { id: string; from: string; subject: string } | null;
  subtasks: Subtask[];
  createdAt: string;
};
export type SmartView = "today" | "upcoming" | "overdue" | "completed" | "all";
export type TaskView = { kind: "smart"; smart: SmartView } | { kind: "list"; listId: string };

export type TaskState = {
  initialized: boolean;
  taskLists: TaskList[];
  tasks: Task[];
  activeView: TaskView;
  loading: boolean;

  init: () => void;
  fetchTaskLists: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  selectSmartView: (view: SmartView) => void;
  selectList: (listId: string) => void;
  createList: (name: string, color: string) => Promise<{ error?: string }>;
  renameList: (id: string, name: string, color: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  createTask: (input: {
    title: string;
    listId?: string;
    description?: string;
    dueAt?: string | null;
    dueHasTime?: boolean;
    priority?: Priority;
    sourceEmailId?: string;
  }) => Promise<void>;
  updateTask: (
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      dueAt: string | null;
      dueHasTime: boolean;
      priority: Priority;
      listId: string;
    }>
  ) => Promise<void>;
  toggleComplete: (id: string, completed: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTask: (id: string, listId: string, position: number) => Promise<void>;
  createSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
};

export const useTaskStore = create<TaskState>((set, get) => ({
  initialized: false,
  taskLists: [],
  tasks: [],
  activeView: { kind: "smart", smart: "today" },
  loading: true,

  init() {
    if (get().initialized) return;
    set({ initialized: true });
    void get().fetchTaskLists();
    void get().fetchTasks();
  },

  async fetchTaskLists() {
    const res = await fetch("/api/task-lists");
    const { taskLists } = await res.json();
    set({ taskLists });
  },

  async fetchTasks() {
    set({ loading: true });
    const res = await fetch("/api/tasks");
    const { tasks } = await res.json();
    set({ tasks, loading: false });
  },

  selectSmartView(smart) {
    set({ activeView: { kind: "smart", smart } });
  },

  selectList(listId) {
    set({ activeView: { kind: "list", listId } });
  },

  async createList(name, color) {
    const res = await fetch("/api/task-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) return { error: await readError(res) };
    await get().fetchTaskLists();
    return {};
  },

  async renameList(id, name, color) {
    await fetch(`/api/task-lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    await get().fetchTaskLists();
  },

  async deleteList(id) {
    await fetch(`/api/task-lists/${id}`, { method: "DELETE" });
    const view = get().activeView;
    if (view.kind === "list" && view.listId === id) {
      set({ activeView: { kind: "smart", smart: "all" } });
    }
    await get().fetchTaskLists();
    await get().fetchTasks();
  },

  async createTask(input) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const { task } = await res.json();
    set((state) => ({ tasks: [...state.tasks, task] }));
  },

  async updateTask(id, input) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? task : t)) }));
  },

  async toggleComplete(id, completed) {
    const prev = get().tasks;
    set({
      tasks: prev.map((t) =>
        t.id === id ? { ...t, completed, completedAt: completed ? new Date().toISOString() : null } : t
      ),
    });
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) {
      set({ tasks: prev });
      return;
    }
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? task : t)) }));
  },

  async deleteTask(id) {
    const prev = get().tasks;
    set({ tasks: prev.filter((t) => t.id !== id) });
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) set({ tasks: prev });
  },

  async reorderTask(id, listId, position) {
    const prev = get().tasks;
    set({ tasks: reorderList(prev, id, listId, position) });
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, position }),
    });
    if (!res.ok) {
      set({ tasks: prev });
      return;
    }
    await get().fetchTasks();
  },

  async createSubtask(taskId, title) {
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === taskId ? task : t)) }));
  },

  async toggleSubtask(taskId, subtaskId, completed) {
    const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === taskId ? task : t)) }));
  },

  async deleteSubtask(taskId, subtaskId) {
    const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
    const { task } = await res.json();
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === taskId ? task : t)) }));
  },
}));

// Pure — reorders `tasks` so `movingId` sits at `targetPosition` within
// `targetListId`, renumbering that list's positions to 0..n. Used by
// `reorderTask` for the optimistic update, and unit-tested directly.
export function reorderList(
  tasks: Task[],
  movingId: string,
  targetListId: string,
  targetPosition: number
): Task[] {
  const moving = tasks.find((t) => t.id === movingId);
  if (!moving) return tasks;
  const withoutMoving = tasks.filter((t) => t.id !== movingId);
  const destSiblings = withoutMoving
    .filter((t) => t.listId === targetListId)
    .sort((a, b) => a.position - b.position);
  const index = Math.max(0, Math.min(targetPosition, destSiblings.length));
  destSiblings.splice(index, 0, { ...moving, listId: targetListId });
  const renumbered = destSiblings.map((t, i) => ({ ...t, position: i }));
  const others = withoutMoving.filter((t) => t.listId !== targetListId);
  return [...others, ...renumbered];
}

function byDueDate(a: Task, b: Task): number {
  if (a.dueAt === null) return b.dueAt === null ? 0 : 1;
  if (b.dueAt === null) return -1;
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

// Pure selector — unit-tested directly with a fixed `now` for determinism.
export function filteredTasks(
  state: Pick<TaskState, "tasks" | "activeView">,
  now: Date = new Date()
): Task[] {
  const view = state.activeView;
  if (view.kind === "list") {
    return state.tasks.filter((t) => t.listId === view.listId).sort((a, b) => a.position - b.position);
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  switch (view.smart) {
    case "today":
      return state.tasks
        .filter((t) => !t.completed && t.dueAt !== null && new Date(t.dueAt) < startOfTomorrow)
        .sort(byDueDate);
    case "upcoming":
      return state.tasks
        .filter((t) => !t.completed && t.dueAt !== null && new Date(t.dueAt) >= startOfTomorrow)
        .sort(byDueDate);
    case "overdue":
      return state.tasks
        .filter((t) => !t.completed && t.dueAt !== null && new Date(t.dueAt) < startOfToday)
        .sort(byDueDate);
    case "completed":
      return state.tasks.filter((t) => t.completed).sort(byDueDate);
    case "all":
      return state.tasks.filter((t) => !t.completed).sort(byDueDate);
  }
}

export function useFilteredTasks(): Task[] {
  return useTaskStore(useShallow((s) => filteredTasks(s)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd web && npx vitest run lib/stores/task-store.test.ts
```

Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add web/lib/stores/task-store.ts web/lib/stores/task-store.test.ts
git commit -m "Add task-store with filtering, reordering, and optimistic updates"
```

---

## Task 7: Sidebar nav entry

**Files:**
- Modify: `web/components/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing new (plain `<a href="/tasks">`, no store).

- [ ] **Step 1: Add the `usePathname` import and `CheckSquare` icon**

In `web/components/Sidebar.tsx`, change:

```tsx
"use client";

import { useState } from "react";
import {
  Archive,
```

to:

```tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Archive,
  CheckSquare,
```

- [ ] **Step 2: Read the pathname and render the Productivity section**

Inside `export function Sidebar(...)`, right after the existing:

```tsx
  const selectFolder = useInboxStore((s) => s.selectFolder);
```

add:

```tsx
  const pathname = usePathname();
```

Then, right after the closing `</nav>` of the `FOLDER_NAV` block and before `<LabelsNav onNavigate={onClose} />`, add:

```tsx
        <div className="mt-6">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
            Productivity
          </p>
          <nav className="flex flex-col gap-1">
            <a
              href="/tasks"
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                pathname === "/tasks"
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "text-text-secondary hover:bg-surface-subtle"
              }`}
            >
              <CheckSquare size={18} weight={pathname === "/tasks" ? "fill" : "regular"} />
              Tasks
            </a>
          </nav>
        </div>
```

- [ ] **Step 3: Verify in the browser**

Start the dev server, open `/inbox`, confirm a "PRODUCTIVITY" section with a "Tasks" link appears below the folder nav (it 404s until Task 8 — that's expected for now).

- [ ] **Step 4: Commit**

```bash
git add web/components/Sidebar.tsx
git commit -m "Add Tasks entry to the sidebar"
```

---

## Task 8: `/tasks` page shell + list/view nav

**Files:**
- Create: `web/app/(app)/tasks/page.tsx`
- Create: `web/app/(app)/tasks/TasksClient.tsx`
- Create: `web/components/tasks/TaskListNav.tsx`

**Interfaces:**
- Consumes: `useTaskStore`, `TaskList` type from `@/lib/stores/task-store` (Task 6); `TopBar`, `Sidebar`, `Dialog`, `Input`, `Button`, `IconButton` (existing).
- Produces: the `/tasks` route renders a working page shell with view/list navigation. `TaskListNav` exposes no props — it's self-contained via the store, matching `LabelsNav`'s pattern.

- [ ] **Step 1: Write the page**

`web/app/(app)/tasks/page.tsx`:

```tsx
import { TasksClient } from "./TasksClient";

export default function TasksPage() {
  return <TasksClient />;
}
```

- [ ] **Step 2: Write the list/view nav**

`web/components/tasks/TaskListNav.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  CalendarBlank,
  CheckCircle,
  PencilSimpleLine,
  Plus,
  Stack,
  Sun,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { useTaskStore, type SmartView } from "@/lib/stores/task-store";

const LIST_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

const SMART_VIEWS: Array<{ id: SmartView; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "upcoming", label: "Upcoming", icon: CalendarBlank },
  { id: "overdue", label: "Overdue", icon: WarningCircle },
  { id: "completed", label: "Completed", icon: CheckCircle },
  { id: "all", label: "All", icon: Stack },
];

export function TaskListNav() {
  const activeView = useTaskStore((s) => s.activeView);
  const selectSmartView = useTaskStore((s) => s.selectSmartView);
  const selectList = useTaskStore((s) => s.selectList);
  const taskLists = useTaskStore((s) => s.taskLists);
  const createList = useTaskStore((s) => s.createList);
  const renameList = useTaskStore((s) => s.renameList);
  const deleteList = useTaskStore((s) => s.deleteList);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = taskLists.find((l) => l.id === editingId) ?? null;

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border p-4">
      <nav className="flex flex-col gap-1">
        {SMART_VIEWS.map(({ id, label, icon: Icon }) => {
          const active = activeView.kind === "smart" && activeView.smart === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectSmartView(id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "text-text-secondary hover:bg-surface-subtle"
              }`}
            >
              <Icon size={16} weight={active ? "fill" : "regular"} />
              {label}
            </button>
          );
        })}
      </nav>

      <p className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
        Lists
      </p>
      <nav className="flex flex-col gap-1">
        {taskLists.map((list) => (
          <div key={list.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => selectList(list.id)}
              className={`flex flex-1 items-center gap-3 truncate rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                activeView.kind === "list" && activeView.listId === list.id
                  ? "bg-surface-subtle font-medium text-foreground"
                  : "text-text-secondary hover:bg-surface-subtle"
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: list.color }} />
              <span className="flex-1 truncate">{list.name}</span>
            </button>
            <div className="hidden shrink-0 gap-0.5 group-hover:flex">
              <IconButton label={`Rename ${list.name}`} onClick={() => setEditingId(list.id)} className="h-6 w-6">
                <PencilSimpleLine size={12} />
              </IconButton>
              {!list.isDefault && (
                <IconButton
                  label={`Delete ${list.name}`}
                  tone="danger"
                  onClick={() => deleteList(list.id)}
                  className="h-6 w-6"
                >
                  <X size={12} />
                </IconButton>
              )}
            </div>
          </div>
        ))}
      </nav>

      <Dialog open={editing !== null} onClose={() => setEditingId(null)} title="Rename list">
        {editing && (
          <ListForm
            initialName={editing.name}
            initialColor={editing.color}
            onSubmit={(name, color) => {
              renameList(editing.id, name, color);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        )}
      </Dialog>

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-subtle"
      >
        <Plus size={16} />
        Create list
      </button>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Create list">
        <ListForm
          onSubmit={async (name, color) => {
            const { error } = await createList(name, color);
            if (!error) setCreating(false);
          }}
          submitLabel="Create"
        />
      </Dialog>
    </aside>
  );
}

function ListForm({
  initialName = "",
  initialColor = LIST_COLORS[0],
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  initialColor?: string;
  submitLabel?: string;
  onSubmit: (name: string, color: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="List name"
        autoFocus
      />
      <div className="flex flex-wrap gap-1.5">
        {LIST_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={submit} className="w-fit">
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="w-fit">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the client shell**

`web/app/(app)/tasks/TasksClient.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { TaskListNav } from "@/components/tasks/TaskListNav";
import { useTaskStore } from "@/lib/stores/task-store";

export function TasksClient() {
  const { data: session } = authClient.useSession();

  const hydrated = useRef<true | null>(null);
  if (hydrated.current === null) {
    useTaskStore.getState().init();
    hydrated.current = true;
  }

  return (
    <div className="flex h-screen flex-col bg-surface-subtle">
      <TopBar
        user={{
          name: session?.user.name ?? "",
          email: session?.user.email ?? "",
          image: session?.user.image,
        }}
      />
      <div className="flex flex-1 overflow-hidden bg-surface">
        <Sidebar />
        <div className="flex flex-1 overflow-hidden">
          <TaskListNav />
          <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
            <p className="text-sm text-text-secondary">Task list goes here (Task 9).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

(The placeholder middle column is replaced in Task 9.)

- [ ] **Step 4: Verify in the browser**

Visit `/tasks`. Confirm: TopBar renders, Sidebar renders with the "Tasks" link highlighted active, the left mini-nav shows Today/Upcoming/Overdue/Completed/All plus an "Inbox" list (auto-created), and creating/renaming/deleting a list works.

- [ ] **Step 5: Commit**

```bash
git add "web/app/(app)/tasks" web/components/tasks/TaskListNav.tsx
git commit -m "Add /tasks page shell with view and list navigation"
```

---

## Task 9: Task list column — quick add, rows, complete toggle, drag-and-drop

**Files:**
- Create: `web/components/tasks/TaskList.tsx`
- Modify: `web/app/(app)/tasks/TasksClient.tsx`

**Interfaces:**
- Consumes: `useFilteredTasks`, `useTaskStore`, `Task`, `Priority` from `@/lib/stores/task-store` (Task 6); `Checkbox`, `Input` (existing).
- Produces: `TaskList` component takes `onOpenTask: (task: Task) => void` — Task 10's detail dialog is opened through this callback.

- [ ] **Step 1: Write the task list column**

`web/components/tasks/TaskList.tsx`:

```tsx
"use client";

import { useState } from "react";
import { DotsSixVertical, EnvelopeSimple, Flag, TrashSimple } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { IconButton } from "@/components/ui/IconButton";
import { useFilteredTasks, useTaskStore, type Priority, type Task } from "@/lib/stores/task-store";

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "text-text-muted",
  NORMAL: "text-text-secondary",
  HIGH: "text-amber-500",
  URGENT: "text-red-600",
};

function formatDue(dueAt: string, dueHasTime: boolean): string {
  const date = new Date(dueAt);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(dueHasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function TaskList({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
  const tasks = useFilteredTasks();
  const activeView = useTaskStore((s) => s.activeView);
  const createTask = useTaskStore((s) => s.createTask);
  const toggleComplete = useTaskStore((s) => s.toggleComplete);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const reorderTask = useTaskStore((s) => s.reorderTask);

  const [quickTitle, setQuickTitle] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");

  // Reordering is only meaningful within a single real list — a smart view
  // (Today/Upcoming/...) can span many lists, where "position" has no single
  // reference frame.
  const listId = activeView.kind === "list" ? activeView.listId : null;
  const visibleTasks = priorityFilter === "ALL" ? tasks : tasks.filter((t) => t.priority === priorityFilter);
  // Position indices are computed against the full (unfiltered) list, so
  // dragging is only safe when the priority filter isn't narrowing what's shown.
  const dragEnabled = listId !== null && priorityFilter === "ALL";

  async function submitQuickAdd() {
    const title = quickTitle.trim();
    if (!title) return;
    setQuickTitle("");
    await createTask(listId ? { title, listId } : { title });
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitQuickAdd()}
          placeholder="Add a task…"
        />
        <Select
          aria-label="Filter by priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | "ALL")}
          className="w-auto shrink-0"
        >
          <option value="ALL">All priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </Select>
      </div>
      <ul className="flex flex-col gap-1">
        {visibleTasks.map((task) => (
          <li
            key={task.id}
            draggable={dragEnabled}
            onDragStart={() => setDraggingId(task.id)}
            onDragOver={(e) => dragEnabled && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragEnabled || !listId || !draggingId || draggingId === task.id) return;
              const targetIndex = visibleTasks.findIndex((t) => t.id === task.id);
              void reorderTask(draggingId, listId, targetIndex);
              setDraggingId(null);
            }}
            className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-subtle"
          >
            {dragEnabled && (
              <DotsSixVertical size={14} className="shrink-0 cursor-grab text-text-muted" />
            )}
            <Checkbox
              checked={task.completed}
              onChange={(e) => toggleComplete(task.id, e.target.checked)}
            />
            <button
              type="button"
              onClick={() => onOpenTask(task)}
              className={`flex min-w-0 flex-1 items-center gap-2 text-left text-sm ${
                task.completed ? "text-text-muted line-through" : "text-foreground"
              }`}
            >
              <span className="truncate">{task.title}</span>
              {task.sourceEmail && <EnvelopeSimple size={13} className="shrink-0 text-text-muted" />}
            </button>
            {task.priority !== "NORMAL" && (
              <Flag size={14} weight="fill" className={`shrink-0 ${PRIORITY_COLOR[task.priority]}`} />
            )}
            {task.dueAt && (
              <span
                className={`shrink-0 whitespace-nowrap text-xs ${
                  !task.completed && new Date(task.dueAt) < new Date() ? "text-red-600" : "text-text-secondary"
                }`}
              >
                {formatDue(task.dueAt, task.dueHasTime)}
              </span>
            )}
            <IconButton
              label="Delete task"
              tone="danger"
              onClick={() => deleteTask(task.id)}
              className="hidden h-6 w-6 shrink-0 group-hover:flex"
            >
              <TrashSimple size={12} />
            </IconButton>
          </li>
        ))}
        {visibleTasks.length === 0 && <li className="px-2 py-6 text-center text-sm text-text-secondary">No tasks here.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `TasksClient`**

In `web/app/(app)/tasks/TasksClient.tsx`, replace the placeholder middle column. Change:

```tsx
import { TaskListNav } from "@/components/tasks/TaskListNav";
import { useTaskStore } from "@/lib/stores/task-store";
```

to:

```tsx
import { TaskListNav } from "@/components/tasks/TaskListNav";
import { TaskList } from "@/components/tasks/TaskList";
import { useTaskStore, type Task } from "@/lib/stores/task-store";
```

and change:

```tsx
          <TaskListNav />
          <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
            <p className="text-sm text-text-secondary">Task list goes here (Task 9).</p>
          </div>
```

to:

```tsx
          <TaskListNav />
          <TaskList onOpenTask={(task: Task) => console.log("open detail (Task 10)", task)} />
```

- [ ] **Step 3: Verify in the browser**

On `/tasks`: type into "Add a task…" and press Enter — it appears in the list. Check its checkbox — it strikes through and (after switching to the "Completed" view) shows up there. Select a real list (not a smart view), add two tasks, and drag one above the other — order persists after a page reload. Set one task's priority to "Urgent" (via Task 10's detail dialog, once that's built) and confirm the priority filter dropdown narrows the view to just that task.

- [ ] **Step 4: Commit**

```bash
git add web/components/tasks/TaskList.tsx "web/app/(app)/tasks/TasksClient.tsx"
git commit -m "Add task list column with quick-add, complete toggle, and drag-and-drop reorder"
```

---

## Task 10: Task detail dialog — description, due date/time, priority, subtasks

**Files:**
- Create: `web/components/tasks/TaskDetailDialog.tsx`
- Modify: `web/app/(app)/tasks/TasksClient.tsx`

**Interfaces:**
- Consumes: `useTaskStore`, `Task`, `Priority` from `@/lib/stores/task-store` (Task 6); `Dialog`, `Select`, `Input`, `Checkbox`, `IconButton`, `ConfirmDialog` (existing).
- Produces: `TaskDetailDialog` takes `task: Task | null; onClose: () => void`.

- [ ] **Step 1: Write the dialog**

`web/components/tasks/TaskDetailDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus, TrashSimple, X } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { useTaskStore, type Priority, type Task } from "@/lib/stores/task-store";

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

function toDateInputValue(dueAt: string | null): string {
  if (!dueAt) return "";
  return dueAt.slice(0, 10);
}

function toTimeInputValue(dueAt: string | null): string {
  if (!dueAt) return "";
  return new Date(dueAt).toTimeString().slice(0, 5);
}

export function TaskDetailDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const taskLists = useTaskStore((s) => s.taskLists);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const createSubtask = useTaskStore((s) => s.createSubtask);
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const deleteSubtask = useTaskStore((s) => s.deleteSubtask);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");

  if (!task) return null;

  function setDue(dateStr: string, timeStr: string) {
    if (!task) return;
    if (!dateStr) {
      updateTask(task.id, { dueAt: null, dueHasTime: false });
      return;
    }
    const iso = timeStr ? new Date(`${dateStr}T${timeStr}`).toISOString() : new Date(`${dateStr}T00:00`).toISOString();
    updateTask(task.id, { dueAt: iso, dueHasTime: !!timeStr });
  }

  return (
    <>
      <Dialog open={task !== null} onClose={onClose} title="Task">
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <Input
            type="text"
            defaultValue={task.title}
            key={`title-${task.id}`}
            onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && updateTask(task.id, { title: e.target.value.trim() })}
          />
          <textarea
            defaultValue={task.description ?? ""}
            key={`desc-${task.id}`}
            placeholder="Description"
            rows={3}
            onBlur={(e) => updateTask(task.id, { description: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-surface p-2.5 text-sm text-foreground"
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              defaultValue={toDateInputValue(task.dueAt)}
              key={`date-${task.id}`}
              onChange={(e) => setDue(e.target.value, toTimeInputValue(task.dueAt))}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
            <input
              type="time"
              defaultValue={toTimeInputValue(task.dueAt)}
              key={`time-${task.id}`}
              disabled={!task.dueAt}
              onChange={(e) => setDue(toDateInputValue(task.dueAt), e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
            />
            <Select
              aria-label="Priority"
              value={task.priority}
              onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
            >
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="List"
              value={task.listId}
              onChange={(e) => updateTask(task.id, { listId: e.target.value })}
            >
              {taskLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </Select>
          </div>

          {task.sourceEmail && (
            <a
              href={`/inbox?emailId=${task.sourceEmail.id}`}
              className="w-fit rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-subtle"
            >
              Open source email: {task.sourceEmail.subject}
            </a>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Subtasks</p>
            <div className="flex flex-col gap-1">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="group flex items-center gap-2">
                  <Checkbox
                    checked={subtask.completed}
                    onChange={(e) => toggleSubtask(task.id, subtask.id, e.target.checked)}
                  />
                  <span className={`flex-1 text-sm ${subtask.completed ? "text-text-muted line-through" : "text-foreground"}`}>
                    {subtask.title}
                  </span>
                  <IconButton
                    label="Delete subtask"
                    onClick={() => deleteSubtask(task.id, subtask.id)}
                    className="hidden h-6 w-6 group-hover:flex"
                  >
                    <X size={12} />
                  </IconButton>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !newSubtask.trim()) return;
                  createSubtask(task.id, newSubtask.trim());
                  setNewSubtask("");
                }}
                placeholder="Add subtask…"
              />
              <IconButton
                label="Add subtask"
                onClick={() => {
                  if (!newSubtask.trim()) return;
                  createSubtask(task.id, newSubtask.trim());
                  setNewSubtask("");
                }}
              >
                <Plus size={14} />
              </IconButton>
            </div>
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmingDelete(true)}
            className="w-fit"
          >
            <TrashSimple size={14} />
            Delete task
          </Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete task"
        message={`Delete "${task.title}"? This can't be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          deleteTask(task.id);
          setConfirmingDelete(false);
          onClose();
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Wire it into `TasksClient`**

In `web/app/(app)/tasks/TasksClient.tsx`, add state for the open task and render the dialog. Change:

```tsx
"use client";

import { useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { TaskListNav } from "@/components/tasks/TaskListNav";
import { TaskList } from "@/components/tasks/TaskList";
import { useTaskStore, type Task } from "@/lib/stores/task-store";

export function TasksClient() {
  const { data: session } = authClient.useSession();

  const hydrated = useRef<true | null>(null);
```

to:

```tsx
"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { TaskListNav } from "@/components/tasks/TaskListNav";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useTaskStore, type Task } from "@/lib/stores/task-store";

export function TasksClient() {
  const { data: session } = authClient.useSession();
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const tasks = useTaskStore((s) => s.tasks);
  const liveOpenTask = openTask ? tasks.find((t) => t.id === openTask.id) ?? null : null;

  const hydrated = useRef<true | null>(null);
```

and change (this includes the two trailing `</div>` closes already in the file from Task 9 — replace the whole block through the final `);}` in one go, don't just swap the two component lines, or you'll end up with duplicate closing tags):

```tsx
          <TaskListNav />
          <TaskList onOpenTask={(task: Task) => console.log("open detail (Task 10)", task)} />
        </div>
      </div>
    </div>
  );
}
```

to:

```tsx
          <TaskListNav />
          <TaskList onOpenTask={setOpenTask} />
        </div>
      </div>
      <TaskDetailDialog task={liveOpenTask} onClose={() => setOpenTask(null)} />
    </div>
  );
}
```

(`TaskDetailDialog` renders as a sibling of the flex layout, not nested inside it, since `Dialog` uses a native `<dialog>` that shouldn't be affected by the flex/overflow ancestors.)

- [ ] **Step 3: Verify in the browser**

Click a task row — the detail dialog opens. Edit the title (blur to save), set a due date and time, change priority, move it to a different list (it disappears from the current list view), add/toggle/delete a subtask, then delete the task entirely and confirm it's gone.

- [ ] **Step 4: Commit**

```bash
git add web/components/tasks/TaskDetailDialog.tsx "web/app/(app)/tasks/TasksClient.tsx"
git commit -m "Add task detail dialog with subtasks, due date/time, priority, and list move"
```

---

## Task 11: Email → Task ("Add to Tasks" from the reading pane)

**Files:**
- Create: `web/components/tasks/AddToTaskDialog.tsx`
- Modify: `web/components/ReadingPane.tsx`

**Interfaces:**
- Consumes: `useTaskStore` (Task 6).
- Produces: `AddToTaskDialog` takes `open: boolean; onClose: () => void; emailId: string; defaultTitle: string`.

- [ ] **Step 1: Write the dialog**

`web/components/tasks/AddToTaskDialog.tsx`. Note: the repo's `react-hooks/set-state-in-effect`
lint rule forbids calling a local `setState` synchronously inside an effect
body, so this splits into an outer wrapper (only the `fetchTaskLists` side
effect lives here) and an inner form that remounts fresh per email via
`key={emailId}`, computing its fields as plain `useState` initializers
instead of syncing them in from props via an effect:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useTaskStore, type TaskList } from "@/lib/stores/task-store";

function isoAtLocalMidnight(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export function AddToTaskDialog({
  open,
  onClose,
  emailId,
  defaultTitle,
}: {
  open: boolean;
  onClose: () => void;
  emailId: string;
  defaultTitle: string;
}) {
  const taskLists = useTaskStore((s) => s.taskLists);
  const fetchTaskLists = useTaskStore((s) => s.fetchTaskLists);

  // Fetching (an external system) belongs in an effect; the fields below
  // don't — they're derived fresh per email via the form's `key` instead.
  useEffect(() => {
    if (open && taskLists.length === 0) void fetchTaskLists();
  }, [open, taskLists.length, fetchTaskLists]);

  return (
    <Dialog open={open} onClose={onClose} title="Add to Tasks">
      {open && (
        <AddToTaskForm
          key={emailId}
          emailId={emailId}
          defaultTitle={defaultTitle}
          taskLists={taskLists}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function AddToTaskForm({
  emailId,
  defaultTitle,
  taskLists,
  onClose,
}: {
  emailId: string;
  defaultTitle: string;
  taskLists: TaskList[];
  onClose: () => void;
}) {
  const createTask = useTaskStore((s) => s.createTask);
  const [title, setTitle] = useState(defaultTitle);
  const [listId, setListId] = useState("");
  const [dueAt, setDueAt] = useState<string | null>(null);
  // Falls back to the first list live during render, so a list that loads
  // in after this form mounts (the dialog can open before fetchTaskLists
  // resolves) is picked up without needing an effect to sync it into state.
  const selectedListId = listId || taskLists[0]?.id || "";

  async function submit() {
    if (!title.trim()) return;
    await createTask({
      title: title.trim(),
      listId: selectedListId || undefined,
      dueAt,
      dueHasTime: false,
      sourceEmailId: emailId,
    });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3">
      <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Today", value: isoAtLocalMidnight(0) },
          { label: "Tomorrow", value: isoAtLocalMidnight(1) },
          { label: "Next week", value: isoAtLocalMidnight(7) },
          { label: "No due date", value: null },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setDueAt(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              dueAt === opt.value
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10"
                : "border-border text-text-secondary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <Select aria-label="List" value={selectedListId} onChange={(e) => setListId(e.target.value)}>
        {taskLists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </Select>
      <Button type="button" onClick={submit} className="w-fit" disabled={!title.trim()}>
        Add task
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire the button into `ReadingPane`**

In `web/components/ReadingPane.tsx`, add the import. Change:

```tsx
import {
  Archive,
  ArrowBendDoubleUpLeft,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowLeft,
  ArrowUUpLeft,
  CaretDown,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  Flag,
  Paperclip,
  ShieldWarning,
  Star,
  Tag,
  TrashSimple,
} from "@phosphor-icons/react";
import { DrawablyBadge, DrawablyButton, DrawablyDivider } from "drawably/react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/ai/SummaryCard";
import { AiReplyBar } from "@/components/ai/AiReplyBar";
```

to:

```tsx
import {
  Archive,
  ArrowBendDoubleUpLeft,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowLeft,
  ArrowUUpLeft,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckSquare,
  DownloadSimple,
  Flag,
  Paperclip,
  ShieldWarning,
  Star,
  Tag,
  TrashSimple,
} from "@phosphor-icons/react";
import { DrawablyBadge, DrawablyButton, DrawablyDivider } from "drawably/react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { SummaryCard } from "@/components/ai/SummaryCard";
import { AiReplyBar } from "@/components/ai/AiReplyBar";
import { AddToTaskDialog } from "@/components/tasks/AddToTaskDialog";
```

Add local state right after `const router = useRouter();`:

```tsx
  const router = useRouter();
  const [addingTask, setAddingTask] = useState(false);
```

(add `useState` to the existing `import { useMemo } from "react";` line, making it `import { useMemo, useState } from "react";`).

Add the button in the toolbar row, right before the existing `<LabelPicker ... />`:

```tsx
          <ActionButton label="Add to Tasks" onClick={() => setAddingTask(true)}>
            <CheckSquare size={16} />
          </ActionButton>
          <LabelPicker email={email} labels={labels} onSetLabels={setEmailLabels} />
```

Add the dialog right before the closing `</div>` of the component's root `<div className="flex flex-1 flex-col overflow-y-auto">`, i.e. right after the closing `</div>` of `<div className="flex-1 overflow-y-auto p-4 sm:p-8">`:

```tsx
      </div>
      <AddToTaskDialog
        open={addingTask}
        onClose={() => setAddingTask(false)}
        emailId={email.id}
        defaultTitle={email.subject}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Open an email in the inbox, click the new "Add to Tasks" button (checkbox-square icon) in the toolbar, confirm the dialog opens pre-filled with the email's subject, pick "Tomorrow" and a list, submit, then go to `/tasks` and confirm the task appears with a small envelope icon next to its title.

- [ ] **Step 4: Commit**

```bash
git add web/components/tasks/AddToTaskDialog.tsx web/components/ReadingPane.tsx
git commit -m "Add 'Add to Tasks' action to the email reading pane"
```

---

## Task 12: "Open Email" round-trip from a task back to its source email

**Files:**
- Modify: `web/app/(app)/inbox/InboxClient.tsx`

**Interfaces:**
- Consumes: `useInboxStore` (existing) — `selectEmail(id)`.

- [ ] **Step 1: Read the `emailId` query param and open it**

In `web/app/(app)/inbox/InboxClient.tsx`, change:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
```

to:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
```

Then, right after the existing polling `useEffect` block (after its closing `}, []);`), add:

```tsx

  const searchParams = useSearchParams();
  useEffect(() => {
    const emailId = searchParams.get("emailId");
    if (emailId) void useInboxStore.getState().selectEmail(emailId);
    // Intentionally runs once per mount only — this is a one-shot deep link,
    // not a synced-with-the-URL view; the reading pane's own state takes
    // over after the initial open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

No `<Suspense>` boundary is needed around this: Next's rule (`node_modules/next/dist/docs/.../use-search-params.md`) only forces one for a *statically* prerendered page, and `app/(app)/inbox/page.tsx` already calls `await headers()` in `getUserId`, which opts the route into dynamic (per-request) rendering.

- [ ] **Step 2: Verify in the browser**

From a task's detail dialog with a source email, click "Open source email:" — it navigates to `/inbox?emailId=<id>` and that email opens directly in the reading pane.

- [ ] **Step 3: Commit**

```bash
git add "web/app/(app)/inbox/InboxClient.tsx"
git commit -m "Open a deep-linked email from a task's source-email reference"
```

---

## Task 13: OpenAPI documentation

**Files:**
- Modify: `web/public/openapi.json`

**Interfaces:**
- None — documentation only, no runtime code.

- [ ] **Step 1: Add schemas**

In `web/public/openapi.json`, inside `components.schemas`, add three entries alongside the existing `Label` schema:

```json
"Priority": {
  "type": "string",
  "enum": ["LOW", "NORMAL", "HIGH", "URGENT"]
},
"TaskList": {
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "userId": { "type": "string", "format": "uuid" },
    "name": { "type": "string" },
    "color": { "type": "string", "example": "#6b7280" },
    "isDefault": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" }
  }
},
"Subtask": {
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "completed": { "type": "boolean" },
    "position": { "type": "integer" }
  }
},
"Task": {
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "userId": { "type": "string", "format": "uuid" },
    "listId": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "description": { "type": "string", "nullable": true },
    "dueAt": { "type": "string", "format": "date-time", "nullable": true },
    "dueHasTime": { "type": "boolean" },
    "priority": { "$ref": "#/components/schemas/Priority" },
    "completed": { "type": "boolean" },
    "completedAt": { "type": "string", "format": "date-time", "nullable": true },
    "position": { "type": "integer" },
    "sourceEmail": {
      "type": "object",
      "nullable": true,
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "from": { "type": "string" },
        "subject": { "type": "string" }
      }
    },
    "subtasks": { "type": "array", "items": { "$ref": "#/components/schemas/Subtask" } },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

- [ ] **Step 2: Add paths**

Inside `paths`, add six entries alongside the existing `/api/labels` entries:

```json
"/api/task-lists": {
  "get": {
    "tags": ["Tasks"],
    "summary": "List the current user's task lists (auto-creates a default 'Inbox' list)",
    "responses": {
      "200": {
        "description": "OK",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": { "taskLists": { "type": "array", "items": { "$ref": "#/components/schemas/TaskList" } } }
            }
          }
        }
      },
      "401": { "$ref": "#/components/responses/Unauthorized" }
    }
  },
  "post": {
    "tags": ["Tasks"],
    "summary": "Create a task list",
    "requestBody": {
      "required": true,
      "content": {
        "application/json": {
          "schema": {
            "type": "object",
            "required": ["name"],
            "properties": { "name": { "type": "string" }, "color": { "type": "string" } }
          }
        }
      }
    },
    "responses": {
      "200": {
        "description": "Created",
        "content": { "application/json": { "schema": { "type": "object", "properties": { "taskList": { "$ref": "#/components/schemas/TaskList" } } } } }
      },
      "400": { "description": "name is required", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "409": { "description": "A list with that name already exists", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } }
    }
  }
},
"/api/task-lists/{id}": {
  "patch": {
    "tags": ["Tasks"],
    "summary": "Rename or recolor a task list",
    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
    "requestBody": {
      "content": { "application/json": { "schema": { "type": "object", "properties": { "name": { "type": "string" }, "color": { "type": "string" } } } } }
    },
    "responses": {
      "200": { "description": "Updated", "content": { "application/json": { "schema": { "type": "object", "properties": { "taskList": { "$ref": "#/components/schemas/TaskList" } } } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "404": { "$ref": "#/components/responses/NotFound" }
    }
  },
  "delete": {
    "tags": ["Tasks"],
    "summary": "Delete a task list (its tasks move to the default list); the default list can't be deleted",
    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
    "responses": {
      "200": { "description": "Deleted", "content": { "application/json": { "schema": { "type": "object", "properties": { "ok": { "type": "boolean" } } } } } },
      "400": { "description": "Can't delete the default list", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "404": { "$ref": "#/components/responses/NotFound" }
    }
  }
},
"/api/tasks": {
  "get": {
    "tags": ["Tasks"],
    "summary": "List all of the current user's tasks (with subtasks and source email), unfiltered",
    "responses": {
      "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "object", "properties": { "tasks": { "type": "array", "items": { "$ref": "#/components/schemas/Task" } } } } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" }
    }
  },
  "post": {
    "tags": ["Tasks"],
    "summary": "Create a task",
    "requestBody": {
      "required": true,
      "content": {
        "application/json": {
          "schema": {
            "type": "object",
            "required": ["title"],
            "properties": {
              "title": { "type": "string" },
              "listId": { "type": "string", "format": "uuid" },
              "description": { "type": "string" },
              "dueAt": { "type": "string", "format": "date-time" },
              "dueHasTime": { "type": "boolean" },
              "priority": { "$ref": "#/components/schemas/Priority" },
              "sourceEmailId": { "type": "string", "format": "uuid" }
            }
          }
        }
      }
    },
    "responses": {
      "200": { "description": "Created", "content": { "application/json": { "schema": { "type": "object", "properties": { "task": { "$ref": "#/components/schemas/Task" } } } } } },
      "400": { "description": "title is required", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "404": { "description": "list or sourceEmail not found", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } }
    }
  }
},
"/api/tasks/{id}": {
  "patch": {
    "tags": ["Tasks"],
    "summary": "Edit a task's fields, complete/reopen it, move it between lists, or reorder it",
    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
    "requestBody": {
      "content": {
        "application/json": {
          "schema": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "description": { "type": "string", "nullable": true },
              "dueAt": { "type": "string", "format": "date-time", "nullable": true },
              "dueHasTime": { "type": "boolean" },
              "priority": { "$ref": "#/components/schemas/Priority" },
              "completed": { "type": "boolean" },
              "listId": { "type": "string", "format": "uuid" },
              "position": { "type": "integer" }
            }
          }
        }
      }
    },
    "responses": {
      "200": { "description": "Updated", "content": { "application/json": { "schema": { "type": "object", "properties": { "task": { "$ref": "#/components/schemas/Task" } } } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "404": { "$ref": "#/components/responses/NotFound" }
    }
  },
  "delete": {
    "tags": ["Tasks"],
    "summary": "Delete a task",
    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
    "responses": {
      "200": { "description": "Deleted", "content": { "application/json": { "schema": { "type": "object", "properties": { "ok": { "type": "boolean" } } } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "404": { "$ref": "#/components/responses/NotFound" }
    }
  }
},
"/api/tasks/{id}/subtasks": {
  "post": {
    "tags": ["Tasks"],
    "summary": "Add a subtask to a task",
    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
    "requestBody": {
      "required": true,
      "content": { "application/json": { "schema": { "type": "object", "required": ["title"], "properties": { "title": { "type": "string" } } } } }
    },
    "responses": {
      "200": { "description": "Created", "content": { "application/json": { "schema": { "type": "object", "properties": { "task": { "$ref": "#/components/schemas/Task" } } } } } },
      "400": { "description": "title is required", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "404": { "$ref": "#/components/responses/NotFound" }
    }
  }
},
"/api/tasks/{id}/subtasks/{subtaskId}": {
  "patch": {
    "tags": ["Tasks"],
    "summary": "Toggle or rename a subtask",
    "parameters": [
      { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } },
      { "name": "subtaskId", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
    ],
    "requestBody": {
      "content": { "application/json": { "schema": { "type": "object", "properties": { "title": { "type": "string" }, "completed": { "type": "boolean" } } } } }
    },
    "responses": {
      "200": { "description": "Updated", "content": { "application/json": { "schema": { "type": "object", "properties": { "task": { "$ref": "#/components/schemas/Task" } } } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "404": { "$ref": "#/components/responses/NotFound" }
    }
  },
  "delete": {
    "tags": ["Tasks"],
    "summary": "Delete a subtask",
    "parameters": [
      { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } },
      { "name": "subtaskId", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
    ],
    "responses": {
      "200": { "description": "Deleted", "content": { "application/json": { "schema": { "type": "object", "properties": { "task": { "$ref": "#/components/schemas/Task" } } } } } },
      "401": { "$ref": "#/components/responses/Unauthorized" },
      "404": { "$ref": "#/components/responses/NotFound" }
    }
  }
}
```

- [ ] **Step 3: Validate the JSON**

```bash
cd web && python3 -c "import json; json.load(open('public/openapi.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add web/public/openapi.json
git commit -m "Document the Tasks API in openapi.json"
```

---

## Final check

- [ ] Run the full test suite: `cd web && npm run test` — expect all tests (existing + new `task-store.test.ts`) to pass.
- [ ] Run the linter: `cd web && npm run lint` — expect no new errors.
- [ ] Click through the full flow once end-to-end in the browser: create a list → add a task with a due date and priority → add two subtasks and complete one → drag-reorder two tasks → open an email → "Add to Tasks" → confirm it shows up in `/tasks` with the envelope icon → open its source email via the dialog's link → complete and delete a task.
