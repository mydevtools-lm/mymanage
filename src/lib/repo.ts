import "server-only";
import { getDb, localDateKey, newId, seedDefaults } from "./db";
import type {
  CalendarEvent,
  Category,
  Checklist,
  DataSnapshot,
  Note,
  Routine,
  Subtask,
  Task,
  Transaction,
} from "./types";
import { instanceId, occursOn } from "./routines";

const now = () => new Date().toISOString();

// node:sqlite types rows as Record<string, SQLOutputValue>; the schema above
// guarantees the shapes, so narrow them in one place instead of at each call.
function rows<T>(value: unknown): T[] {
  return value as T[];
}
function row<T>(value: unknown): T | null {
  return (value ?? null) as T | null;
}

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
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function listTasks(): Task[] {
  return rows<TaskRow>(
    getDb().prepare("SELECT * FROM tasks ORDER BY createdAt").all(),
  ).map(toTask);
}

export function createTask(input: Partial<Task>): Task {
  const id = input.id ?? newId();
  const stamp = now();
  getDb()
    .prepare(
      `INSERT INTO tasks
       (id,title,description,dueDate,dueTime,priority,categoryId,completed,completedAt,archivedAt,routineId,subtasks,position,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
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
      input.createdAt ?? stamp,
      stamp,
    );
  return getTask(id)!;
}

export function getTask(id: string): Task | null {
  const found = row<TaskRow>(
    getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id),
  );
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
] as const;

export function updateTask(id: string, patch: Partial<Task>): Task | null {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

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
  getDb()
    .prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
  return getTask(id);
}

export function deleteTask(id: string) {
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

/** Hand-picked order: each id gets its index as its position. */
export function reorderTasks(ids: string[]) {
  const db = getDb();
  const stmt = db.prepare("UPDATE tasks SET position = ? WHERE id = ?");
  db.exec("BEGIN");
  try {
    ids.forEach((id, index) => stmt.run(index, id));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
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

export function listRoutines(): Routine[] {
  return rows<RoutineRow>(
    getDb().prepare("SELECT * FROM routines ORDER BY createdAt, rowid").all(),
  ).map(toRoutine);
}

export function getRoutine(id: string): Routine | null {
  const found = row<RoutineRow>(
    getDb().prepare("SELECT * FROM routines WHERE id = ?").get(id),
  );
  return found ? toRoutine(found) : null;
}

export function createRoutine(input: Partial<Routine>): Routine {
  const id = input.id ?? newId();
  const stamp = now();
  getDb()
    .prepare(
      `INSERT INTO routines
       (id,title,description,priority,categoryId,dueTime,repeat,startDate,lastDate,paused,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
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
    );
  return getRoutine(id)!;
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

export function updateRoutine(
  id: string,
  patch: Partial<Routine>,
): Routine | null {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
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
  getDb()
    .prepare(`UPDATE routines SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);

  const copyPatch: Partial<Task> = {};
  for (const field of CARRIED_TO_COPY) {
    if (field in patch) Object.assign(copyPatch, { [field]: patch[field] });
  }
  const copy = getTask(instanceId(id, localDateKey()));
  if (copy && !copy.archivedAt && Object.keys(copyPatch).length > 0) {
    updateTask(copy.id, copyPatch);
  }
  return getRoutine(id);
}

/** Past copies stay in the archive as history; only the routine goes. */
export function deleteRoutine(id: string) {
  getDb().prepare("DELETE FROM routines WHERE id = ?").run(id);
}

/**
 * Makes today's copy of every routine that falls today and doesn't have one
 * yet. A copy left open from an earlier day is filed away first, so missed
 * days don't pile up as overdue. Safe to call on every load: each routine is
 * handled at most once a day, and a copy's id is fixed by routine and day.
 */
export function ensureRoutineCopies(today: string = localDateKey()): Task[] {
  const db = getDb();
  const made: Task[] = [];
  for (const routine of listRoutines()) {
    if ((routine.lastDate ?? "") >= today) continue;
    if (!occursOn(routine, today)) continue;
    const stamp = now();
    db.prepare(
      `UPDATE tasks SET archivedAt = ?, updatedAt = ?
       WHERE routineId = ? AND completed = 0 AND archivedAt IS NULL
         AND dueDate < ?`,
    ).run(stamp, stamp, routine.id, today);
    const id = instanceId(routine.id, today);
    if (!getTask(id)) {
      made.push(
        createTask({
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
    db.prepare("UPDATE routines SET lastDate = ? WHERE id = ?").run(
      today,
      routine.id,
    );
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
  createdAt: string;
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
    createdAt: r.createdAt,
  };
}

export function listEvents(): CalendarEvent[] {
  return rows<EventRow>(
    getDb().prepare("SELECT * FROM events ORDER BY date, startTime").all(),
  ).map(toEvent);
}

export function createEvent(input: Partial<CalendarEvent>): CalendarEvent {
  const id = input.id ?? newId();
  getDb()
    .prepare(
      `INSERT INTO events (id,title,date,startTime,endTime,allDay,location,notes,color,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      input.title ?? "",
      input.date ?? "",
      input.startTime ?? null,
      input.endTime ?? null,
      input.allDay ? 1 : 0,
      input.location ?? null,
      input.notes ?? null,
      input.color ?? "teal",
      input.createdAt ?? now(),
    );
  return getEvent(id)!;
}

export function getEvent(id: string): CalendarEvent | null {
  const found = row<EventRow>(
    getDb().prepare("SELECT * FROM events WHERE id = ?").get(id),
  );
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
] as const;

export function updateEvent(
  id: string,
  patch: Partial<CalendarEvent>,
): CalendarEvent | null {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const field of EVENT_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    sets.push(`${field} = ?`);
    if (field === "allDay") values.push(value ? 1 : 0);
    else values.push((value as string | undefined) ?? null);
  }
  if (sets.length === 0) return getEvent(id);
  values.push(id);
  getDb()
    .prepare(`UPDATE events SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
  return getEvent(id);
}

export function deleteEvent(id: string) {
  getDb().prepare("DELETE FROM events WHERE id = ?").run(id);
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

export function listTransactions(): Transaction[] {
  return rows<TransactionRow>(
    getDb().prepare("SELECT * FROM transactions ORDER BY date DESC").all(),
  ).map(toTransaction);
}

export function createTransaction(input: Partial<Transaction>): Transaction {
  const id = input.id ?? newId();
  getDb()
    .prepare(
      `INSERT INTO transactions
       (id,type,amount,description,date,categoryId,notes,recurringStartMonth,recurringEndMonth,exceptions,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
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
    );
  return getTransaction(id)!;
}

export function getTransaction(id: string): Transaction | null {
  const found = row<TransactionRow>(
    getDb().prepare("SELECT * FROM transactions WHERE id = ?").get(id),
  );
  return found ? toTransaction(found) : null;
}

export function updateTransaction(
  id: string,
  patch: Partial<Transaction>,
): Transaction | null {
  const current = getTransaction(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  getDb()
    .prepare(
      `UPDATE transactions SET type=?, amount=?, description=?, date=?,
       categoryId=?, notes=?, recurringStartMonth=?, recurringEndMonth=?,
       exceptions=?
       WHERE id = ?`,
    )
    .run(
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
    );
  return getTransaction(id);
}

export function deleteTransaction(id: string) {
  getDb().prepare("DELETE FROM transactions WHERE id = ?").run(id);
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

export function listNotes(): Note[] {
  return rows<NoteRow>(
    getDb()
      .prepare(
        "SELECT * FROM notes ORDER BY pinned DESC, updatedAt DESC, rowid DESC",
      )
      .all(),
  ).map(toNote);
}

export function createNote(input: Partial<Note>): Note {
  const id = input.id ?? newId();
  const stamp = now();
  getDb()
    .prepare(
      "INSERT INTO notes (id,title,body,pinned,color,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      id,
      input.title ?? "",
      input.body ?? "",
      input.pinned ? 1 : 0,
      input.color ?? null,
      input.createdAt ?? stamp,
      input.updatedAt ?? stamp,
    );
  return getNote(id)!;
}

export function getNote(id: string): Note | null {
  const found = row<NoteRow>(
    getDb().prepare("SELECT * FROM notes WHERE id = ?").get(id),
  );
  return found ? toNote(found) : null;
}

export function updateNote(id: string, patch: Partial<Note>): Note | null {
  const current = getNote(id);
  if (!current) return null;
  // Pinning or recolouring is not an edit of the note, so it keeps its date.
  const contentChanged = "title" in patch || "body" in patch;
  const next = { ...current, ...patch };
  getDb()
    .prepare(
      "UPDATE notes SET title=?, body=?, pinned=?, color=?, updatedAt=? WHERE id=?",
    )
    .run(
      next.title ?? current.title,
      next.body ?? current.body,
      next.pinned ? 1 : 0,
      next.color ?? null,
      contentChanged ? now() : current.updatedAt,
      id,
    );
  return getNote(id);
}

export function deleteNote(id: string) {
  getDb().prepare("DELETE FROM notes WHERE id = ?").run(id);
}

/* ----------------------------------------------------------- checklists */

export function listChecklists(): Checklist[] {
  const db = getDb();
  // Stable order: pinned first, then newest list. Sorting by updatedAt made
  // a list jump to the top every time an item was ticked mid-shop.
  const lists = rows<Omit<Checklist, "items" | "pinned"> & { pinned: number }>(
    db
      .prepare(
        "SELECT * FROM checklists ORDER BY pinned DESC, createdAt DESC, rowid DESC",
      )
      .all(),
  );
  const items = rows<{
    id: string;
    listId: string;
    text: string;
    done: number;
  }>(
    db.prepare("SELECT * FROM checklist_items ORDER BY position, rowid").all(),
  );

  return lists.map((list) => ({
    ...list,
    pinned: !!list.pinned,
    items: items
      .filter((i) => i.listId === list.id)
      .map((i) => ({ id: i.id, text: i.text, done: !!i.done })),
  }));
}

export function getChecklist(id: string): Checklist | null {
  return listChecklists().find((l) => l.id === id) ?? null;
}

type NewItem = string | { id?: string; text: string };

export function createChecklist(
  title: string,
  items: NewItem[] = [],
  id: string = newId(),
) {
  const db = getDb();
  const stamp = now();
  db.prepare(
    "INSERT INTO checklists (id,title,createdAt,updatedAt) VALUES (?,?,?,?)",
  ).run(id, title, stamp, stamp);

  const insert = db.prepare(
    "INSERT INTO checklist_items (id,listId,text,done,position) VALUES (?,?,?,0,?)",
  );
  items.forEach((item, index) => {
    const { id: itemId = newId(), text } =
      typeof item === "string" ? { text: item } : item;
    insert.run(itemId, id, text, index);
  });
  return getChecklist(id)!;
}

export function renameChecklist(id: string, title: string) {
  getDb()
    .prepare("UPDATE checklists SET title=?, updatedAt=? WHERE id=?")
    .run(title, now(), id);
  return getChecklist(id);
}

export function setChecklistPinned(id: string, pinned: boolean) {
  getDb()
    .prepare("UPDATE checklists SET pinned=? WHERE id=?")
    .run(pinned ? 1 : 0, id);
  return getChecklist(id);
}

/** Untick everything — the same shopping list, ready for next week. */
export function resetChecklist(listId: string) {
  getDb()
    .prepare("UPDATE checklist_items SET done=0 WHERE listId=?")
    .run(listId);
  touchChecklist(listId);
  return getChecklist(listId);
}

/** Store a new item order. Ids not in `order` keep their place after it. */
export function reorderChecklistItems(listId: string, order: string[]) {
  const db = getDb();
  const current = rows<{ id: string }>(
    db
      .prepare(
        "SELECT id FROM checklist_items WHERE listId=? ORDER BY position, rowid",
      )
      .all(listId),
  ).map((r) => r.id);
  const known = new Set(current);
  const wanted = order.filter((id) => known.has(id));
  const rest = current.filter((id) => !wanted.includes(id));
  const setPosition = db.prepare(
    "UPDATE checklist_items SET position=? WHERE id=? AND listId=?",
  );
  [...wanted, ...rest].forEach((id, i) => setPosition.run(i, id, listId));
  touchChecklist(listId);
  return getChecklist(listId);
}

export function deleteChecklist(id: string) {
  getDb().prepare("DELETE FROM checklists WHERE id = ?").run(id);
}

function touchChecklist(listId: string) {
  getDb()
    .prepare("UPDATE checklists SET updatedAt=? WHERE id=?")
    .run(now(), listId);
}

/**
 * Appends an item, or — when `index` is given — puts it back at that spot.
 * The index form is how "undo" restores a deleted item to where it was.
 */
export function addChecklistItem(
  listId: string,
  text: string,
  itemId: string = newId(),
  options: { index?: number; done?: boolean } = {},
) {
  const db = getDb();
  const done = options.done ? 1 : 0;

  if (options.index === undefined) {
    const { next } = row<{ next: number }>(
      db
        .prepare(
          "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM checklist_items WHERE listId = ?",
        )
        .get(listId),
    )!;
    db.prepare(
      "INSERT INTO checklist_items (id,listId,text,done,position) VALUES (?,?,?,?,?)",
    ).run(itemId, listId, text, done, next);
  } else {
    // Renumber densely in the current order, leaving a gap at `index`.
    const ids = rows<{ id: string }>(
      db
        .prepare(
          "SELECT id FROM checklist_items WHERE listId = ? ORDER BY position, rowid",
        )
        .all(listId),
    ).map((r) => r.id);
    const at = Math.max(0, Math.min(options.index, ids.length));
    const setPosition = db.prepare(
      "UPDATE checklist_items SET position = ? WHERE id = ?",
    );
    ids.forEach((id, i) => setPosition.run(i < at ? i : i + 1, id));
    db.prepare(
      "INSERT INTO checklist_items (id,listId,text,done,position) VALUES (?,?,?,?,?)",
    ).run(itemId, listId, text, done, at);
  }

  touchChecklist(listId);
  return getChecklist(listId);
}

export function setChecklistItem(
  listId: string,
  itemId: string,
  patch: { text?: string; done?: boolean },
) {
  const db = getDb();
  if (patch.text !== undefined) {
    db.prepare("UPDATE checklist_items SET text=? WHERE id=? AND listId=?").run(
      patch.text,
      itemId,
      listId,
    );
  }
  if (patch.done !== undefined) {
    db.prepare("UPDATE checklist_items SET done=? WHERE id=? AND listId=?").run(
      patch.done ? 1 : 0,
      itemId,
      listId,
    );
  }
  touchChecklist(listId);
  return getChecklist(listId);
}

export function deleteChecklistItem(listId: string, itemId: string) {
  getDb()
    .prepare("DELETE FROM checklist_items WHERE id=? AND listId=?")
    .run(itemId, listId);
  touchChecklist(listId);
  return getChecklist(listId);
}

export function clearDoneChecklistItems(listId: string) {
  getDb()
    .prepare("DELETE FROM checklist_items WHERE listId=? AND done=1")
    .run(listId);
  touchChecklist(listId);
  return getChecklist(listId);
}

/* ----------------------------------------------------------- categories */

export function listCategories(): Category[] {
  return rows<Category>(
    getDb().prepare("SELECT * FROM categories ORDER BY kind, name").all(),
  );
}

export function createCategory(
  input: Omit<Category, "id"> & { id?: string },
): Category {
  const id = input.id ?? newId();
  getDb()
    .prepare("INSERT INTO categories (id,name,color,kind) VALUES (?,?,?,?)")
    .run(id, input.name, input.color, input.kind);
  return { name: input.name, color: input.color, kind: input.kind, id };
}

export function updateCategory(id: string, patch: Partial<Category>) {
  const current = listCategories().find((c) => c.id === id);
  if (!current) return null;
  const next = { ...current, ...patch };
  getDb()
    .prepare("UPDATE categories SET name=?, color=? WHERE id=?")
    .run(next.name, next.color, id);
  return next;
}

export function deleteCategory(id: string) {
  // ON DELETE SET NULL on the referencing tables keeps the items themselves.
  getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
}

/* ------------------------------------------------------------- settings */

export function getStartMonth(): string {
  const found = row<{ value: string }>(
    getDb().prepare("SELECT value FROM settings WHERE key='startMonth'").get(),
  );
  return found?.value ?? new Date().toISOString().slice(0, 7);
}

/* ------------------------------------------------------- whole snapshot */

export function readAll(): DataSnapshot {
  return {
    version: 1,
    exportedAt: now(),
    tasks: listTasks(),
    events: listEvents(),
    transactions: listTransactions(),
    notes: listNotes(),
    checklists: listChecklists(),
    routines: listRoutines(),
    categories: listCategories(),
    settings: { startMonth: getStartMonth() },
  };
}

/** Replaces everything. Used by both the JSON import and the one-time
 *  migration of data that was living in localStorage. */
export function replaceAll(snapshot: Partial<DataSnapshot>) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    for (const table of [
      "checklist_items",
      "checklists",
      "notes",
      "transactions",
      "events",
      "tasks",
      "routines",
      "categories",
    ]) {
      db.exec(`DELETE FROM ${table}`);
    }

    for (const c of snapshot.categories ?? []) {
      db.prepare(
        "INSERT INTO categories (id,name,color,kind) VALUES (?,?,?,?)",
      ).run(c.id, c.name, c.color, c.kind);
    }
    for (const r of snapshot.routines ?? []) createRoutine(r);
    for (const t of snapshot.tasks ?? []) createTask(t);
    for (const e of snapshot.events ?? []) createEvent(e);
    for (const t of snapshot.transactions ?? []) createTransaction(t);
    for (const n of snapshot.notes ?? []) createNote(n);
    for (const l of snapshot.checklists ?? []) {
      db.prepare(
        "INSERT INTO checklists (id,title,pinned,createdAt,updatedAt) VALUES (?,?,?,?,?)",
      ).run(l.id, l.title, l.pinned ? 1 : 0, l.createdAt, l.updatedAt);
      l.items.forEach((item, index) =>
        db
          .prepare(
            "INSERT INTO checklist_items (id,listId,text,done,position) VALUES (?,?,?,?,?)",
          )
          .run(item.id, l.id, item.text, item.done ? 1 : 0, index),
      );
    }
    if (snapshot.settings?.startMonth) {
      db.prepare(
        "INSERT OR REPLACE INTO settings (key,value) VALUES ('startMonth', ?)",
      ).run(snapshot.settings.startMonth);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return readAll();
}

export function clearAll() {
  const db = getDb();
  for (const table of [
    "checklist_items",
    "checklists",
    "notes",
    "transactions",
    "events",
    "tasks",
    "routines",
    "categories",
    "settings",
  ]) {
    db.exec(`DELETE FROM ${table}`);
  }
  // Categories and the start month are structural, not user content —
  // put them straight back so the app is usable after a wipe.
  seedDefaults(db);
  return readAll();
}
