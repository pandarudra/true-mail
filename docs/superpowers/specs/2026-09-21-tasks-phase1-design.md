# TrueMail Tasks Feature (Phase 1) — Design Spec

Status: Approved by user 2026-09-21. Ready for implementation planning.

## 1. Scope

Phase 1 of the "Tasks" productivity feature from the user's roadmap (see
`docs/superpowers/specs/` roadmap discussion): a standalone task manager
inside TrueMail, plus the "Add to Tasks" bridge from an email.

In scope:

- Task CRUD: title, description, due date, due time, priority, subtasks.
- Complete / reopen a task.
- Flat task lists (create/rename/delete a list, move a task between
  lists) — **no nesting** (the spec's "Projects > TrueMail/College" tree
  is deferred; flat lists cover the same need with far less UI/query
  complexity).
- Drag-and-drop ordering within a list.
- Views: Today, Upcoming, Overdue, Completed, All, by list, by priority.
- Email → Task: an "Add to Tasks" action on an open email that creates a
  task retaining a link back to the source email.

Explicitly out of scope for Phase 1 (deferred to later phases per the
roadmap's own ordering):

- Recurring tasks, reminders/notifications (roadmap items 1's
  "Recurring Tasks" and "Task Notifications" subsections, and all of
  item 6 "Reminders").
- Task notes/attachments/links beyond the description field, and the
  universal Quick Add / Ctrl+K palette (roadmap items 15, 17) — those
  touch Notes and Calendar too and belong with those phases.
- Keep (Notes) and Calendar entirely (Phases 2–3 of the roadmap).

## 2. Data model

Three new Prisma models, one new relation on `Email`:

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

`User` gains `taskLists TaskList[]` and `tasks Task[]`. `Email` gains
`tasks Task[]` (inverse of `sourceEmail`, no cascade — deleting an email
detaches the task from it via `SetNull` rather than deleting the task).

Notes on field choices:

- **`dueAt` + `dueHasTime`** instead of separate due-date/due-time
  columns: one nullable `DateTime` covers both ("due tomorrow" = date at
  midnight, `dueHasTime: false`; "due tomorrow 6pm" = full timestamp,
  `dueHasTime: true`). `dueHasTime` only changes *rendering* (show a
  clock or not) — fewer columns, same information.
- **`position` is a plain `Int`**, reindexed across the affected list on
  every reorder (renumber 0..n). At personal-task-list scale (tens to
  low hundreds of tasks per list) this is cheap and avoids the
  complexity of fractional-position rebalancing.
  <!-- ponytail: full renumber on reorder, switch to fractional/gap
  positions if lists ever grow into the thousands and reorder latency
  becomes visible -->
- **No `Subtask` -> `Subtask` nesting** — one level only, matching the
  roadmap's own examples (no sub-subtasks shown anywhere in it).
- A default `TaskList` named "Inbox" (`isDefault: true`) is created
  lazily for a user the first time they hit a tasks endpoint and have no
  lists yet — mirrors the existing lazy-default-mailbox pattern. It
  can't be deleted; deleting any other list reassigns its tasks to the
  default list first (matches `Mailbox` deletion guard: last one can't
  be removed).

## 3. API routes

All follow the existing convention exactly: `getUserId(req.headers)` →
401 if none; ownership-scoped Prisma queries (`where: { userId, ... }`)
→ 404 if not found/not owned, same as `app/api/labels`,
`app/api/mailboxes`.

- **`GET /api/task-lists`** — all lists for the user, creating the
  default "Inbox" list first if none exist. **`POST`** — `{ name, color? }`,
  409 on duplicate name (matches label creation).
- **`PATCH /api/task-lists/[id]`** — rename/recolor. **`DELETE`** —
  400 if it's the default list or the user's only list; otherwise
  reassigns its tasks to the default list, then deletes it.
- **`GET /api/tasks`** — all of the user's tasks (with `subtasks` and a
  minimal `sourceEmail: { id, from, subject }` include), unfiltered.
  Filtering by Today/Upcoming/Overdue/Completed/list/priority happens
  client-side in the store/selectors — the same pattern `inbox-store`
  already uses for folder filtering, and avoids a combinatorial set of
  query-param filters for what's realistically a small per-user dataset.
  **`POST`** — `{ listId?, title, description?, dueAt?, dueHasTime?,
  priority?, sourceEmailId? }`; `listId` defaults to the user's default
  list if omitted; `position` is set to `max(position) + 1` within the
  target list.
- **`PATCH /api/tasks/[id]`** — partial update; used for editing fields,
  completing/reopening (`{ completed: true }` also sets `completedAt`),
  and moving/reordering (`{ listId?, position }` triggers a renumber of
  the affected list(s)).
- **`DELETE /api/tasks/[id]`**.
- **`POST /api/tasks/[id]/subtasks`** — `{ title }`, appended at the end
  of that task's subtasks.
- **`PATCH /api/tasks/[id]/subtasks/[subtaskId]`** — toggle/rename.
  **`DELETE`**.

## 4. Store

`lib/stores/task-store.ts`, same shape as `lib/stores/inbox-store.ts`:
`tasks: Task[]`, `taskLists: TaskList[]`, `activeView` (one of
`"today" | "upcoming" | "overdue" | "completed" | "all" | { list: string }`),
plus actions (`fetchAll`, `createTask`, `updateTask`, `deleteTask`,
`toggleComplete`, `reorderTask`, `createList`, `renameList`,
`deleteList`, `createSubtask`, `toggleSubtask`, `deleteSubtask`) that
optimistically update local state, then call the API, rolling back on
failure — matching `inbox-store`'s existing optimistic-update pattern
(e.g. `toggleStar`).

A `useFilteredTasks()` selector hook (parallel to `useFilteredEmails`)
computes the visible list for the current `activeView`: `today` = due
today or overdue and not completed; `upcoming` = due after today, not
completed; `overdue` = `dueAt < now` and not completed; `completed` =
`completed: true`; `all` = everything not completed; `{ list }` = tasks
in that list regardless of completion.

## 5. UI

- **Sidebar** (`components/Sidebar.tsx`): a new "PRODUCTIVITY" section
  below the existing folder nav, one entry — "Tasks" (`CheckSquare`
  icon) — linking to `/tasks`. (Keep/Calendar entries are added in their
  own future phases, not here.)
- **New route**: `app/(app)/tasks/page.tsx` (server component, same
  session-guard pattern as `app/(app)/layout.tsx` already provides) +
  `app/(app)/tasks/TasksClient.tsx` (client component owning the task
  store), structured like `InboxClient.tsx`:
  - A left mini-nav: the fixed views (Today/Upcoming/Overdue/Completed/
    All) above the user's lists (with inline rename/delete/create,
    mirroring `LabelsNav` in `Sidebar.tsx`).
  - A middle task list: each row has a checkbox, title, due-date badge
    (red if overdue), a priority flag icon, and a drag handle. Reordering
    uses native HTML5 drag-and-drop (`draggable`, `onDragStart`/
    `onDrop`) — no new dependency.
  - A detail panel (opens as a `Dialog`, reusing `components/ui/Dialog`)
    for editing description, due date/time, priority, and subtasks
    (simple add/toggle/delete list), plus an "Open Email" link when the
    task has a `sourceEmail`.
  - A single-line "Add a task…" input at the top of the middle column;
    Enter creates a title-only task in the current view's list (or the
    default list, if the current view is a smart view rather than a
    specific list).
- **Email → Task** (`components/ReadingPane.tsx`): one new
  `ActionButton` (`CheckSquare` icon, alongside the existing
  Star/Flag/Archive/Spam/Delete row) opens a small `Dialog` with: title
  (defaulted to the email subject), a due-date field with quick picks
  (Today/Tomorrow/Next week/Custom, matching the roadmap's "Reminder
  options" language) and a list `Select`. Submitting calls
  `createTask({ ...fields, sourceEmailId: email.id })`.
- **Open Email round-trip**: `InboxClient.tsx` gets a small addition —
  on mount, if the URL has `?emailId=<id>`, call the existing
  `selectEmail(id)` action (same one row-clicks already use) to open
  that email in the Reading Pane. The task's "Open Email" link is then
  just `<a href="/inbox?emailId=${sourceEmail.id}">`.

## 6. Error handling

Same as the rest of the app: failed API calls surface via an inline
`text-red-600` message near the affected control (task row, dialog,
quick-add input); optimistic store updates roll back on a non-2xx
response. No new error-handling infrastructure.

## 7. Explicit cuts (and why)

- **No nested lists.** Flat lists cover the same organizing need as the
  roadmap's Projects tree with a fraction of the UI and query
  complexity (no recursive fetch, no tree-rendering component). Revisit
  if users actually need project sub-grouping.
- **No recurrence or reminders.** These are their own subsystems
  (a recurrence-rule engine, a notification/scheduling mechanism) that
  the roadmap itself schedules as separate phases — bundling them here
  would double the review surface for no Phase-1 benefit.
- **No attachments/links on tasks.** Would require wiring the existing
  Cloudinary upload flow into a new entity; deferred to a dedicated pass
  per the user's explicit choice during design.
- **No universal Quick Add (Ctrl/Cmd+K).** That command palette spans
  Task/Note/Event creation together — building it now, before Keep and
  Calendar exist, would mean redesigning it twice.
- **Task GET has no server-side filtering.** The dataset size (a single
  user's tasks) doesn't justify query-param filtering machinery;
  client-side filtering (already the app's convention for email
  folders) is simpler and just as fast at this scale.

## 8. Testing

One new Vitest file, `lib/stores/task-store.test.ts` (parallel to the
existing `inbox-store.test.ts`), covering: `useFilteredTasks` view logic
(today/upcoming/overdue/completed/by-list), `toggleComplete`'s optimistic
update and rollback, and `reorderTask`'s position renumbering — the
non-trivial logic in this feature. CRUD glue over already-tested Prisma
patterns and existing UI primitives doesn't need its own tests.
