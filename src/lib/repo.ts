import { db, type SqlValue, type Statement } from "./db-adapter";
import { localDateKey, localMonthKey, newId } from "./keys";
import { DEFAULT_CATEGORIES } from "./schema";
import type {
  CalendarEvent,
  Category,
  Checklist,
  DataSnapshot,
  Note,
  Link,
  Routine,
  Settings,
  Subtask,
  Task,
  Transaction,
} from "./types";
import { instanceId, occursOn } from "./routines";

/**
 * Every read and write of the app's data. Runs wherever the database is: on
 * the server over node:sqlite, and in the desktop app over the Rust bridge
 * (see db-adapter.ts). Each insert is built by an `…Insert` function, so a
 * single create and a whole-snapshot import write rows the same way.
 */

const now = () => new Date().toISOString();

/* ---------------------------------------------------------------- tasks */

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  categoryId: string | null;
  completed: number;
  completedAt: string | null;
  archivedAt: string | null;
  routineId: string | null;
  subtasks: string | null;
  position: number | null;
  reminder: number | null;
  createdAt: string;
  updatedAt: string;
}

function parseSubtasks(raw: string | null): Subtask[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function serializeSubtasks(value: Subtask[] | null | undefined) {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    dueDate: r.dueDate ?? undefined,
    dueTime: r.dueTime ?? undefined,
    priority: r.priority as Task["priority"],
    categoryId: r.categoryId ?? undefined,
    completed: !!r.completed,
    completedAt: r.completedAt ?? undefined,
    archivedAt: r.archivedAt ?? undefined,
    routineId: r.routineId ?? undefined,
    subtasks: parseSubtasks(r.subtasks),
    position: r.position ?? undefined,
    reminder: r.reminder ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listTasks(): Promise<Task[]> {
  const rows = await db().all<TaskRow>("SELECT * FROM tasks ORDER BY createdAt");
  return rows.map(toTask);
}

function taskInsert(id: string, input: Partial<Task>): Statement {
  const stamp = now();
  return {
    sql: `INSERT INTO tasks
     (id,title,description,dueDate,dueTime,priority,categoryId,completed,completedAt,archivedAt,routineId,subtasks,position,reminder,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    params: [
      id,
      input.title ?? "",
      input.description ?? null,
      input.dueDate ?? null,
      input.dueTime ?? null,
      input.priority ?? "normal",
      input.categoryId ?? null,
      input.completed ? 1 : 0,
      input.completedAt ?? null,
      input.archivedAt ?? null,
      input.routineId ?? null,
      serializeSubtasks(input.subtasks),
      input.position ?? null,
      input.reminder ?? null,
      input.createdAt ?? stamp,
      stamp,
    ],
  };
}

export async function createTask(input: Partial<Task>): Promise<Task> {
  const id = input.id ?? newId();
  const { sql, params } = taskInsert(id, input);
  await db().run(sql, params);
  return (await getTask(id))!;
}

export async function getTask(id: string): Promise<Task | null> {
  const found = await db().get<TaskRow>("SELECT * FROM tasks WHERE id = ?", [id]);
  return found ? toTask(found) : null;
}

const TASK_FIELDS = [
  "title",
  "description",
  "dueDate",
  "dueTime",
  "priority",
  "categoryId",
  "completed",
  "completedAt",
  "archivedAt",
  "subtasks",
  "position",
  "reminder",
] as const;

export async function updateTask(
  id: string,
  patch: Partial<Task>,
): Promise<Task | null> {
  const sets: string[] = [];
  const values: SqlValue[] = [];

  for (const field of TASK_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    sets.push(`${field} = ?`);
    if (field === "completed") values.push(value ? 1 : 0);
    else if (field === "subtasks")
      values.push(serializeSubtasks(value as Subtask[] | undefined));
    else values.push((value as string | number | undefined) ?? null);
  }
  if (sets.length === 0) return getTask(id);

  sets.push("updatedAt = ?");
  values.push(now(), id);
  await db().run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, values);
  return getTask(id);
}

export async function deleteTask(id: string) {
  await db().run("DELETE FROM tasks WHERE id = ?", [id]);
}

/** Hand-picked order: each id gets its index as its position. */
export async function reorderTasks(ids: string[]) {
  await db().batch(
    ids.map((id, index) => ({
      sql: "UPDATE tasks SET position = ? WHERE id = ?",
      params: [index, id],
    })),
  );
}

/* ------------------------------------------------------------- routines */

interface RoutineRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  categoryId: string | null;
  dueTime: string | null;
  repeat: string;
  startDate: string;
  lastDate: string | null;
  paused: number;
  createdAt: string;
  updatedAt: string;
}

function toRoutine(r: RoutineRow): Routine {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    priority: r.priority as Routine["priority"],
    categoryId: r.categoryId ?? undefined,
    dueTime: r.dueTime ?? undefined,
    repeat: JSON.parse(r.repeat),
    startDate: r.startDate,
    lastDate: r.lastDate ?? undefined,
    paused: !!r.paused,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listRoutines(): Promise<Routine[]> {
  const rows = await db().all<RoutineRow>(
    "SELECT * FROM routines ORDER BY createdAt, rowid",
  );
  return rows.map(toRoutine);
}

export async function getRoutine(id: string): Promise<Routine | null> {
  const found = await db().get<RoutineRow>(
    "SELECT * FROM routines WHERE id = ?",
    [id],
  );
  return found ? toRoutine(found) : null;
}

function routineInsert(id: string, input: Partial<Routine>): Statement {
  const stamp = now();
  return {
    sql: `INSERT INTO routines
     (id,title,description,priority,categoryId,dueTime,repeat,startDate,lastDate,paused,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    params: [
      id,
      input.title ?? "",
      input.description ?? null,
      input.priority ?? "normal",
      input.categoryId ?? null,
      input.dueTime ?? null,
      JSON.stringify(input.repeat ?? { kind: "daily" }),
      input.startDate ?? localDateKey(),
      input.lastDate ?? null,
      input.paused ? 1 : 0,
      input.createdAt ?? stamp,
      stamp,
    ],
  };
}

export async function createRoutine(input: Partial<Routine>): Promise<Routine> {
  const id = input.id ?? newId();
  const { sql, params } = routineInsert(id, input);
  await db().run(sql, params);
  return (await getRoutine(id))!;
}

const ROUTINE_FIELDS = [
  "title",
  "description",
  "priority",
  "categoryId",
  "dueTime",
  "repeat",
  "startDate",
  "paused",
] as const;

// What a change to the routine carries over to today's copy, if still open.
const CARRIED_TO_COPY = [
  "title",
  "description",
  "priority",
  "categoryId",
  "dueTime",
] as const;

export async function updateRoutine(
  id: string,
  patch: Partial<Routine>,
): Promise<Routine | null> {
  const sets: string[] = [];
  const values: SqlValue[] = [];
  for (const field of ROUTINE_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    sets.push(`${field} = ?`);
    if (field === "paused") values.push(value ? 1 : 0);
    else if (field === "repeat") values.push(JSON.stringify(value));
    else values.push((value as string | undefined) ?? null);
  }
  if (sets.length === 0) return getRoutine(id);
  sets.push("updatedAt = ?");
  values.push(now(), id);
  await db().run(`UPDATE routines SET ${sets.join(", ")} WHERE id = ?`, values);

  const copyPatch: Partial<Task> = {};
  for (const field of CARRIED_TO_COPY) {
    if (field in patch) Object.assign(copyPatch, { [field]: patch[field] });
  }
  const copy = await getTask(instanceId(id, localDateKey()));
  if (copy && !copy.archivedAt && Object.keys(copyPatch).length > 0) {
    await updateTask(copy.id, copyPatch);
  }
  return getRoutine(id);
}

/** Past copies stay in the archive as history; only the routine goes. */
export async function deleteRoutine(id: string) {
  await db().run("DELETE FROM routines WHERE id = ?", [id]);
}

/**
 * Makes today's copy of every routine that falls today and doesn't have one
 * yet. A copy left open from an earlier day is filed away first, so missed
 * days don't pile up as overdue. Safe to call on every load: each routine is
 * handled at most once a day, and a copy's id is fixed by routine and day.
 */
export async function ensureRoutineCopies(
  today: string = localDateKey(),
): Promise<Task[]> {
  const made: Task[] = [];
  for (const routine of await listRoutines()) {
    if ((routine.lastDate ?? "") >= today) continue;
    if (!occursOn(routine, today)) continue;
    const stamp = now();
    await db().run(
      `UPDATE tasks SET archivedAt = ?, updatedAt = ?
       WHERE routineId = ? AND completed = 0 AND archivedAt IS NULL
         AND dueDate < ?`,
      [stamp, stamp, routine.id, today],
    );
    const id = instanceId(routine.id, today);
    if (!(await getTask(id))) {
      made.push(
        await createTask({
          id,
          title: routine.title,
          description: routine.description,
          dueDate: today,
          dueTime: routine.dueTime,
          priority: routine.priority,
          categoryId: routine.categoryId,
          routineId: routine.id,
        }),
      );
    }
    await db().run("UPDATE routines SET lastDate = ? WHERE id = ?", [
      today,
      routine.id,
    ]);
  }
  return made;
}

/* --------------------------------------------------------------- events */

interface EventRow {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: number;
  location: string | null;
  notes: string | null;
  color: string;
  repeat: string | null;
  until: string | null;
  exceptions: string | null;
  reminder: number | null;
  createdAt: string;
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function toEvent(r: EventRow): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    startTime: r.startTime ?? undefined,
    endTime: r.endTime ?? undefined,
    allDay: !!r.allDay,
    location: r.location ?? undefined,
    notes: r.notes ?? undefined,
    color: r.color as CalendarEvent["color"],
    repeat: parseJson(r.repeat),
    until: r.until ?? undefined,
    // Stored as NULL when empty, so a list here always has something in it.
    exceptions: parseJson(r.exceptions),
    reminder: r.reminder ?? undefined,
    createdAt: r.createdAt,
  };
}

export async function listEvents(): Promise<CalendarEvent[]> {
  const rows = await db().all<EventRow>(
    "SELECT * FROM events ORDER BY date, startTime",
  );
  return rows.map(toEvent);
}

function eventInsert(id: string, input: Partial<CalendarEvent>): Statement {
  return {
    sql: `INSERT INTO events (id,title,date,startTime,endTime,allDay,location,notes,color,repeat,until,exceptions,reminder,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    params: [
      id,
      input.title ?? "",
      input.date ?? "",
      input.startTime ?? null,
      input.endTime ?? null,
      input.allDay ? 1 : 0,
      input.location ?? null,
      input.notes ?? null,
      input.color ?? "teal",
      input.repeat ? JSON.stringify(input.repeat) : null,
      input.until ?? null,
      input.exceptions?.length ? JSON.stringify(input.exceptions) : null,
      input.reminder ?? null,
      input.createdAt ?? now(),
    ],
  };
}

export async function createEvent(
  input: Partial<CalendarEvent>,
): Promise<CalendarEvent> {
  const id = input.id ?? newId();
  const { sql, params } = eventInsert(id, input);
  await db().run(sql, params);
  return (await getEvent(id))!;
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const found = await db().get<EventRow>("SELECT * FROM events WHERE id = ?", [
    id,
  ]);
  return found ? toEvent(found) : null;
}

const EVENT_FIELDS = [
  "title",
  "date",
  "startTime",
  "endTime",
  "allDay",
  "location",
  "notes",
  "color",
  "repeat",
  "until",
  "exceptions",
  "reminder",
] as const;

export async function updateEvent(
  id: string,
  patch: Partial<CalendarEvent>,
): Promise<CalendarEvent | null> {
  const sets: string[] = [];
  const values: SqlValue[] = [];
  for (const field of EVENT_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    sets.push(`${field} = ?`);
    if (field === "allDay") values.push(value ? 1 : 0);
    else if (field === "repeat")
      values.push(value ? JSON.stringify(value) : null);
    else if (field === "exceptions")
      values.push(
        Array.isArray(value) && value.length ? JSON.stringify(value) : null,
      );
    else values.push((value as string | undefined) ?? null);
  }
  if (sets.length === 0) return getEvent(id);
  values.push(id);
  await db().run(`UPDATE events SET ${sets.join(", ")} WHERE id = ?`, values);
  return getEvent(id);
}

export async function deleteEvent(id: string) {
  await db().run("DELETE FROM events WHERE id = ?", [id]);
}

/* --------------------------------------------------------- transactions */

interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  categoryId: string | null;
  notes: string | null;
  recurringStartMonth: string | null;
  recurringEndMonth: string | null;
  exceptions: string | null;
  createdAt: string;
}

function parseExceptions(raw: string | null): Transaction["exceptions"] {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function serializeExceptions(value: Transaction["exceptions"] | null) {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

function toTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    type: r.type as Transaction["type"],
    amount: r.amount,
    description: r.description,
    date: r.date,
    categoryId: r.categoryId ?? undefined,
    notes: r.notes ?? undefined,
    recurring: r.recurringStartMonth
      ? {
          startMonth: r.recurringStartMonth,
          endMonth: r.recurringEndMonth ?? undefined,
        }
      : undefined,
    exceptions: parseExceptions(r.exceptions),
    createdAt: r.createdAt,
  };
}

export async function listTransactions(): Promise<Transaction[]> {
  const rows = await db().all<TransactionRow>(
    "SELECT * FROM transactions ORDER BY date DESC",
  );
  return rows.map(toTransaction);
}

function transactionInsert(
  id: string,
  input: Partial<Transaction>,
): Statement {
  return {
    sql: `INSERT INTO transactions
       (id,type,amount,description,date,categoryId,notes,recurringStartMonth,recurringEndMonth,exceptions,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    params: [
      id,
      input.type ?? "expense",
      input.amount ?? 0,
      input.description ?? "",
      input.date ?? "",
      input.categoryId ?? null,
      input.notes ?? null,
      input.recurring?.startMonth ?? null,
      input.recurring?.endMonth ?? null,
      serializeExceptions(input.exceptions),
      input.createdAt ?? now(),
    ],
  };
}

export async function createTransaction(
  input: Partial<Transaction>,
): Promise<Transaction> {
  const id = input.id ?? newId();
  const { sql, params } = transactionInsert(id, input);
  await db().run(sql, params);
  return (await getTransaction(id))!;
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const found = await db().get<TransactionRow>(
    "SELECT * FROM transactions WHERE id = ?",
    [id],
  );
  return found ? toTransaction(found) : null;
}

export async function updateTransaction(
  id: string,
  patch: Partial<Transaction>,
): Promise<Transaction | null> {
  const current = await getTransaction(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await db().run(
    `UPDATE transactions SET type=?, amount=?, description=?, date=?,
       categoryId=?, notes=?, recurringStartMonth=?, recurringEndMonth=?,
       exceptions=?
       WHERE id = ?`,
    [
      next.type,
      next.amount,
      next.description,
      next.date,
      next.categoryId ?? null,
      next.notes ?? null,
      next.recurring?.startMonth ?? null,
      next.recurring?.endMonth ?? null,
      serializeExceptions(next.exceptions),
      id,
    ],
  );
  return getTransaction(id);
}

export async function deleteTransaction(id: string) {
  await db().run("DELETE FROM transactions WHERE id = ?", [id]);
}

/** Many rows in one database transaction — a bank statement import. */
export async function createTransactions(inputs: Partial<Transaction>[]) {
  const ids = inputs.map((input) => input.id ?? newId());
  await db().batch(inputs.map((input, i) => transactionInsert(ids[i], input)));
  const created: Transaction[] = [];
  for (const id of ids) created.push((await getTransaction(id))!);
  return created;
}

export async function deleteTransactions(ids: string[]) {
  await db().batch(
    ids.map((id) => ({
      sql: "DELETE FROM transactions WHERE id = ?",
      params: [id],
    })),
  );
}

/* ---------------------------------------------------------------- notes */

interface NoteRow {
  id: string;
  title: string;
  body: string;
  pinned: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    pinned: !!r.pinned,
    color: (r.color ?? undefined) as Note["color"],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listNotes(): Promise<Note[]> {
  const rows = await db().all<NoteRow>(
    "SELECT * FROM notes ORDER BY pinned DESC, updatedAt DESC, rowid DESC",
  );
  return rows.map(toNote);
}

function noteInsert(id: string, input: Partial<Note>): Statement {
  const stamp = now();
  return {
    sql: "INSERT INTO notes (id,title,body,pinned,color,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)",
    params: [
      id,
      input.title ?? "",
      input.body ?? "",
      input.pinned ? 1 : 0,
      input.color ?? null,
      input.createdAt ?? stamp,
      input.updatedAt ?? stamp,
    ],
  };
}

export async function createNote(input: Partial<Note>): Promise<Note> {
  const id = input.id ?? newId();
  const { sql, params } = noteInsert(id, input);
  await db().run(sql, params);
  return (await getNote(id))!;
}

export async function getNote(id: string): Promise<Note | null> {
  const found = await db().get<NoteRow>("SELECT * FROM notes WHERE id = ?", [
    id,
  ]);
  return found ? toNote(found) : null;
}

export async function updateNote(
  id: string,
  patch: Partial<Note>,
): Promise<Note | null> {
  const current = await getNote(id);
  if (!current) return null;
  // Pinning or recolouring is not an edit of the note, so it keeps its date.
  const contentChanged = "title" in patch || "body" in patch;
  const next = { ...current, ...patch };
  await db().run(
    "UPDATE notes SET title=?, body=?, pinned=?, color=?, updatedAt=? WHERE id=?",
    [
      next.title ?? current.title,
      next.body ?? current.body,
      next.pinned ? 1 : 0,
      next.color ?? null,
      contentChanged ? now() : current.updatedAt,
      id,
    ],
  );
  return getNote(id);
}

export async function deleteNote(id: string) {
  await db().run("DELETE FROM notes WHERE id = ?", [id]);
}

/* ----------------------------------------------------------- checklists */

export async function listChecklists(): Promise<Checklist[]> {
  // Stable order: pinned first, then newest list. Sorting by updatedAt made
  // a list jump to the top every time an item was ticked mid-shop.
  const lists = await db().all<
    Omit<Checklist, "items" | "pinned"> & { pinned: number }
  >("SELECT * FROM checklists ORDER BY pinned DESC, createdAt DESC, rowid DESC");
  const items = await db().all<{
    id: string;
    listId: string;
    text: string;
    done: number;
  }>("SELECT * FROM checklist_items ORDER BY position, rowid");

  return lists.map((list) => ({
    ...list,
    pinned: !!list.pinned,
    items: items
      .filter((i) => i.listId === list.id)
      .map((i) => ({ id: i.id, text: i.text, done: !!i.done })),
  }));
}

export async function getChecklist(id: string): Promise<Checklist | null> {
  return (await listChecklists()).find((l) => l.id === id) ?? null;
}

type NewItem = string | { id?: string; text: string };

function itemInsert(
  listId: string,
  item: { id: string; text: string; done?: boolean },
  position: number,
): Statement {
  return {
    sql: "INSERT INTO checklist_items (id,listId,text,done,position) VALUES (?,?,?,?,?)",
    params: [item.id, listId, item.text, item.done ? 1 : 0, position],
  };
}

export async function createChecklist(
  title: string,
  items: NewItem[] = [],
  id: string = newId(),
) {
  const stamp = now();
  await db().batch([
    {
      sql: "INSERT INTO checklists (id,title,createdAt,updatedAt) VALUES (?,?,?,?)",
      params: [id, title, stamp, stamp],
    },
    ...items.map((item, index) => {
      const { id: itemId = newId(), text } =
        typeof item === "string" ? { text: item } : item;
      return itemInsert(id, { id: itemId, text }, index);
    }),
  ]);
  return (await getChecklist(id))!;
}

export async function renameChecklist(id: string, title: string) {
  await db().run("UPDATE checklists SET title=?, updatedAt=? WHERE id=?", [
    title,
    now(),
    id,
  ]);
  return getChecklist(id);
}

export async function setChecklistPinned(id: string, pinned: boolean) {
  await db().run("UPDATE checklists SET pinned=? WHERE id=?", [
    pinned ? 1 : 0,
    id,
  ]);
  return getChecklist(id);
}

/** Untick everything — the same shopping list, ready for next week. */
export async function resetChecklist(listId: string) {
  await db().run("UPDATE checklist_items SET done=0 WHERE listId=?", [listId]);
  await touchChecklist(listId);
  return getChecklist(listId);
}

async function itemIds(listId: string) {
  const rows = await db().all<{ id: string }>(
    "SELECT id FROM checklist_items WHERE listId = ? ORDER BY position, rowid",
    [listId],
  );
  return rows.map((r) => r.id);
}

/** Store a new item order. Ids not in `order` keep their place after it. */
export async function reorderChecklistItems(listId: string, order: string[]) {
  const current = await itemIds(listId);
  const known = new Set(current);
  const wanted = order.filter((id) => known.has(id));
  const rest = current.filter((id) => !wanted.includes(id));
  await db().batch([
    ...[...wanted, ...rest].map((id, i) => ({
      sql: "UPDATE checklist_items SET position=? WHERE id=? AND listId=?",
      params: [i, id, listId],
    })),
    touchStatement(listId),
  ]);
  return getChecklist(listId);
}

export async function deleteChecklist(id: string) {
  await db().run("DELETE FROM checklists WHERE id = ?", [id]);
}

function touchStatement(listId: string): Statement {
  return {
    sql: "UPDATE checklists SET updatedAt=? WHERE id=?",
    params: [now(), listId],
  };
}

async function touchChecklist(listId: string) {
  const { sql, params } = touchStatement(listId);
  await db().run(sql, params);
}

/**
 * Appends an item, or — when `index` is given — puts it back at that spot.
 * The index form is how "undo" restores a deleted item to where it was.
 */
export async function addChecklistItem(
  listId: string,
  text: string,
  itemId: string = newId(),
  options: { index?: number; done?: boolean } = {},
) {
  const item = { id: itemId, text, done: options.done };

  if (options.index === undefined) {
    const { next } = (await db().get<{ next: number }>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM checklist_items WHERE listId = ?",
      [listId],
    ))!;
    await db().batch([itemInsert(listId, item, next), touchStatement(listId)]);
  } else {
    // Renumber densely in the current order, leaving a gap at `index`.
    const ids = await itemIds(listId);
    const at = Math.max(0, Math.min(options.index, ids.length));
    await db().batch([
      ...ids.map((id, i) => ({
        sql: "UPDATE checklist_items SET position = ? WHERE id = ?",
        params: [i < at ? i : i + 1, id],
      })),
      itemInsert(listId, item, at),
      touchStatement(listId),
    ]);
  }
  return getChecklist(listId);
}

export async function setChecklistItem(
  listId: string,
  itemId: string,
  patch: { text?: string; done?: boolean },
) {
  const writes: Statement[] = [];
  if (patch.text !== undefined) {
    writes.push({
      sql: "UPDATE checklist_items SET text=? WHERE id=? AND listId=?",
      params: [patch.text, itemId, listId],
    });
  }
  if (patch.done !== undefined) {
    writes.push({
      sql: "UPDATE checklist_items SET done=? WHERE id=? AND listId=?",
      params: [patch.done ? 1 : 0, itemId, listId],
    });
  }
  await db().batch([...writes, touchStatement(listId)]);
  return getChecklist(listId);
}

export async function deleteChecklistItem(listId: string, itemId: string) {
  await db().batch([
    {
      sql: "DELETE FROM checklist_items WHERE id=? AND listId=?",
      params: [itemId, listId],
    },
    touchStatement(listId),
  ]);
  return getChecklist(listId);
}

export async function clearDoneChecklistItems(listId: string) {
  await db().batch([
    {
      sql: "DELETE FROM checklist_items WHERE listId=? AND done=1",
      params: [listId],
    },
    touchStatement(listId),
  ]);
  return getChecklist(listId);
}

/* ----------------------------------------------------------- categories */

export async function listCategories(): Promise<Category[]> {
  return db().all<Category>("SELECT * FROM categories ORDER BY kind, name");
}

function categoryInsert(c: Category): Statement {
  return {
    sql: "INSERT INTO categories (id,name,color,kind) VALUES (?,?,?,?)",
    params: [c.id, c.name, c.color, c.kind],
  };
}

export async function createCategory(
  input: Omit<Category, "id"> & { id?: string },
): Promise<Category> {
  const category: Category = {
    name: input.name,
    color: input.color,
    kind: input.kind,
    id: input.id ?? newId(),
  };
  const { sql, params } = categoryInsert(category);
  await db().run(sql, params);
  return category;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const current = (await listCategories()).find((c) => c.id === id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await db().run("UPDATE categories SET name=?, color=? WHERE id=?", [
    next.name,
    next.color,
    id,
  ]);
  return next;
}

export async function deleteCategory(id: string) {
  // ON DELETE SET NULL on the referencing tables keeps the items themselves.
  await db().run("DELETE FROM categories WHERE id = ?", [id]);
}

/* ---------------------------------------------------------------- links */

export async function listLinks(): Promise<Link[]> {
  return db().all<Link>("SELECT * FROM links ORDER BY createdAt, rowid");
}

function linkInsert(id: string, input: Partial<Link>): Statement {
  return {
    sql: "INSERT INTO links (id,aKind,aId,bKind,bId,createdAt) VALUES (?,?,?,?,?,?)",
    params: [
      id,
      input.aKind ?? "task",
      input.aId ?? "",
      input.bKind ?? "task",
      input.bId ?? "",
      input.createdAt ?? now(),
    ],
  };
}

/** Linking the same two items twice keeps the first link. */
export async function createLink(input: Partial<Link>): Promise<Link> {
  const existing = await db().get<Link>(
    `SELECT * FROM links
     WHERE (aId = ? AND bId = ?) OR (aId = ? AND bId = ?)`,
    [input.aId ?? "", input.bId ?? "", input.bId ?? "", input.aId ?? ""],
  );
  if (existing) return existing;
  const id = input.id ?? newId();
  const { sql, params } = linkInsert(id, input);
  await db().run(sql, params);
  return (await db().get<Link>("SELECT * FROM links WHERE id = ?", [id]))!;
}

export async function deleteLink(id: string) {
  await db().run("DELETE FROM links WHERE id = ?", [id]);
}

/* ------------------------------------------------------------- settings */

async function readSetting<T>(key: string): Promise<T | undefined> {
  const found = await db().get<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return parseJson<T>(found?.value ?? null);
}

function settingWrite(key: string, value: unknown): Statement {
  return {
    sql: "INSERT OR REPLACE INTO settings (key,value) VALUES (?, ?)",
    params: [key, JSON.stringify(value)],
  };
}

async function writeSetting(key: string, value: unknown) {
  const { sql, params } = settingWrite(key, value);
  await db().run(sql, params);
}

export async function getCalendarPrefs(): Promise<Settings["calendars"]> {
  return (await readSetting<Settings["calendars"]>("calendars")) ?? {};
}

export async function setCalendarPrefs(value: Settings["calendars"]) {
  await writeSetting("calendars", value ?? {});
  return getCalendarPrefs();
}

export async function getPrefs(): Promise<NonNullable<Settings["prefs"]>> {
  return (await readSetting<NonNullable<Settings["prefs"]>>("prefs")) ?? {};
}

function mergePrefs(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  const next: Record<string, unknown> = { ...current, ...patch };
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined) delete next[key];
  }
  return next;
}

/** Merges into the stored preferences; a null clears one. */
export async function setPrefs(patch: Record<string, unknown>) {
  await writeSetting("prefs", mergePrefs({ ...(await getPrefs()) }, patch));
  return getPrefs();
}

export async function getBudgets(): Promise<Settings["budgets"]> {
  return (await readSetting<Settings["budgets"]>("budgets")) ?? {};
}

function cleanBudgets(value: Settings["budgets"]) {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(
      ([, amount]) => typeof amount === "number" && amount > 0,
    ),
  );
}

/** Replaces all budgets; a category left out has none. */
export async function setBudgets(value: Settings["budgets"]) {
  await writeSetting("budgets", cleanBudgets(value));
  return getBudgets();
}

export async function getStartMonth(): Promise<string> {
  // Stored as plain text, not JSON, since the first version.
  const found = await db().get<{ value: string }>(
    "SELECT value FROM settings WHERE key='startMonth'",
  );
  return found?.value ?? new Date().toISOString().slice(0, 7);
}

function startMonthWrite(month: string): Statement {
  return {
    sql: "INSERT OR REPLACE INTO settings (key,value) VALUES ('startMonth', ?)",
    params: [month],
  };
}

/* ------------------------------------------------------- whole snapshot */

export async function readAll(): Promise<DataSnapshot> {
  return {
    version: 1,
    exportedAt: now(),
    tasks: await listTasks(),
    events: await listEvents(),
    transactions: await listTransactions(),
    notes: await listNotes(),
    checklists: await listChecklists(),
    routines: await listRoutines(),
    links: await listLinks(),
    categories: await listCategories(),
    settings: {
      startMonth: await getStartMonth(),
      calendars: await getCalendarPrefs(),
      budgets: await getBudgets(),
      prefs: await getPrefs(),
    },
  };
}

const USER_TABLES = [
  "checklist_items",
  "checklists",
  "notes",
  "transactions",
  "events",
  "tasks",
  "routines",
  "links",
  "categories",
];

/** Replaces everything, in one transaction. Used by both the JSON import and
 *  the one-time migration of data that was living in localStorage. */
export async function replaceAll(snapshot: Partial<DataSnapshot>) {
  const writes: Statement[] = USER_TABLES.map((table) => ({
    sql: `DELETE FROM ${table}`,
  }));

  for (const c of snapshot.categories ?? []) writes.push(categoryInsert(c));
  for (const r of snapshot.routines ?? [])
    writes.push(routineInsert(r.id ?? newId(), r));
  // The same pair linked twice keeps the first link, as createLink does.
  const linked = new Set<string>();
  for (const l of snapshot.links ?? []) {
    const pair = [l.aId ?? "", l.bId ?? ""].sort().join("|");
    if (linked.has(pair)) continue;
    linked.add(pair);
    writes.push(linkInsert(l.id ?? newId(), l));
  }
  for (const t of snapshot.tasks ?? []) writes.push(taskInsert(t.id ?? newId(), t));
  for (const e of snapshot.events ?? [])
    writes.push(eventInsert(e.id ?? newId(), e));
  for (const t of snapshot.transactions ?? [])
    writes.push(transactionInsert(t.id ?? newId(), t));
  for (const n of snapshot.notes ?? []) writes.push(noteInsert(n.id ?? newId(), n));
  for (const l of snapshot.checklists ?? []) {
    writes.push({
      sql: "INSERT INTO checklists (id,title,pinned,createdAt,updatedAt) VALUES (?,?,?,?,?)",
      params: [l.id, l.title, l.pinned ? 1 : 0, l.createdAt, l.updatedAt],
    });
    l.items.forEach((item, index) => writes.push(itemInsert(l.id, item, index)));
  }

  const settings = snapshot.settings;
  if (settings?.startMonth) writes.push(startMonthWrite(settings.startMonth));
  if (settings?.calendars) {
    writes.push(settingWrite("calendars", settings.calendars));
  }
  if (settings?.budgets) {
    writes.push(settingWrite("budgets", cleanBudgets(settings.budgets)));
  }
  if (settings?.prefs) {
    writes.push(
      settingWrite(
        "prefs",
        mergePrefs({ ...(await getPrefs()) }, { ...settings.prefs }),
      ),
    );
  }

  await db().batch(writes);
  return readAll();
}

/** What a database needs before anyone uses it: the default categories and
 *  the month the books start. */
export function seedStatements(): Statement[] {
  return [
    ...DEFAULT_CATEGORIES.map(([name, color, kind]) =>
      categoryInsert({
        id: newId(),
        name,
        color: color as Category["color"],
        kind,
      }),
    ),
    startMonthWrite(localMonthKey()),
  ];
}

export async function clearAll() {
  // Categories and the start month are structural, not user content —
  // put them straight back so the app is usable after a wipe.
  await db().batch([
    ...[...USER_TABLES, "settings"].map((table) => ({
      sql: `DELETE FROM ${table}`,
    })),
    ...seedStatements(),
  ]);
  return readAll();
}
