import "server-only";
import { getDb, newId, seedDefaults } from "./db";
import type {
  CalendarEvent,
  Category,
  Checklist,
  DataSnapshot,
  Note,
  Task,
  Transaction,
} from "./types";

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
  priority: string;
  categoryId: string | null;
  completed: number;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    dueDate: r.dueDate ?? undefined,
    priority: r.priority as Task["priority"],
    categoryId: r.categoryId ?? undefined,
    completed: !!r.completed,
    completedAt: r.completedAt ?? undefined,
    archivedAt: r.archivedAt ?? undefined,
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
       (id,title,description,dueDate,priority,categoryId,completed,completedAt,archivedAt,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      input.title ?? "",
      input.description ?? null,
      input.dueDate ?? null,
      input.priority ?? "normal",
      input.categoryId ?? null,
      input.completed ? 1 : 0,
      input.completedAt ?? null,
      input.archivedAt ?? null,
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
  "priority",
  "categoryId",
  "completed",
  "completedAt",
  "archivedAt",
] as const;

export function updateTask(id: string, patch: Partial<Task>): Task | null {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  for (const field of TASK_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    sets.push(`${field} = ?`);
    if (field === "completed") values.push(value ? 1 : 0);
    else values.push((value as string | undefined) ?? null);
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
  createdAt: string;
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
       (id,type,amount,description,date,categoryId,notes,recurringStartMonth,recurringEndMonth,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
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
       categoryId=?, notes=?, recurringStartMonth=?, recurringEndMonth=?
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
      id,
    );
  return getTransaction(id);
}

export function deleteTransaction(id: string) {
  getDb().prepare("DELETE FROM transactions WHERE id = ?").run(id);
}

/* ---------------------------------------------------------------- notes */

export function listNotes(): Note[] {
  return rows<Note>(
    getDb().prepare("SELECT * FROM notes ORDER BY updatedAt DESC").all(),
  );
}

export function createNote(input: Partial<Note>): Note {
  const id = input.id ?? newId();
  const stamp = now();
  getDb()
    .prepare(
      "INSERT INTO notes (id,title,body,createdAt,updatedAt) VALUES (?,?,?,?,?)",
    )
    .run(
      id,
      input.title ?? "",
      input.body ?? "",
      input.createdAt ?? stamp,
      stamp,
    );
  return getNote(id)!;
}

export function getNote(id: string): Note | null {
  return row<Note>(getDb().prepare("SELECT * FROM notes WHERE id = ?").get(id));
}

export function updateNote(id: string, patch: Partial<Note>): Note | null {
  const current = getNote(id);
  if (!current) return null;
  getDb()
    .prepare("UPDATE notes SET title=?, body=?, updatedAt=? WHERE id=?")
    .run(patch.title ?? current.title, patch.body ?? current.body, now(), id);
  return getNote(id);
}

export function deleteNote(id: string) {
  getDb().prepare("DELETE FROM notes WHERE id = ?").run(id);
}

/* ----------------------------------------------------------- checklists */

export function listChecklists(): Checklist[] {
  const db = getDb();
  const lists = rows<Omit<Checklist, "items">>(
    db.prepare("SELECT * FROM checklists ORDER BY updatedAt DESC").all(),
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
    items: items
      .filter((i) => i.listId === list.id)
      .map((i) => ({ id: i.id, text: i.text, done: !!i.done })),
  }));
}

export function getChecklist(id: string): Checklist | null {
  return listChecklists().find((l) => l.id === id) ?? null;
}

export function createChecklist(title: string, items: string[] = []) {
  const db = getDb();
  const id = newId();
  const stamp = now();
  db.prepare(
    "INSERT INTO checklists (id,title,createdAt,updatedAt) VALUES (?,?,?,?)",
  ).run(id, title, stamp, stamp);

  const insert = db.prepare(
    "INSERT INTO checklist_items (id,listId,text,done,position) VALUES (?,?,?,0,?)",
  );
  items.forEach((text, index) => insert.run(newId(), id, text, index));
  return getChecklist(id)!;
}

export function renameChecklist(id: string, title: string) {
  getDb()
    .prepare("UPDATE checklists SET title=?, updatedAt=? WHERE id=?")
    .run(title, now(), id);
  return getChecklist(id);
}

export function deleteChecklist(id: string) {
  getDb().prepare("DELETE FROM checklists WHERE id = ?").run(id);
}

function touchChecklist(listId: string) {
  getDb()
    .prepare("UPDATE checklists SET updatedAt=? WHERE id=?")
    .run(now(), listId);
}

export function addChecklistItem(listId: string, text: string) {
  const db = getDb();
  const { next } = row<{ next: number }>(
    db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM checklist_items WHERE listId = ?",
      )
      .get(listId),
  )!;
  db.prepare(
    "INSERT INTO checklist_items (id,listId,text,done,position) VALUES (?,?,?,0,?)",
  ).run(newId(), listId, text, next);
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

export function createCategory(input: Omit<Category, "id">): Category {
  const id = newId();
  getDb()
    .prepare("INSERT INTO categories (id,name,color,kind) VALUES (?,?,?,?)")
    .run(id, input.name, input.color, input.kind);
  return { ...input, id };
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
      "categories",
    ]) {
      db.exec(`DELETE FROM ${table}`);
    }

    for (const c of snapshot.categories ?? []) {
      db.prepare(
        "INSERT INTO categories (id,name,color,kind) VALUES (?,?,?,?)",
      ).run(c.id, c.name, c.color, c.kind);
    }
    for (const t of snapshot.tasks ?? []) createTask(t);
    for (const e of snapshot.events ?? []) createEvent(e);
    for (const t of snapshot.transactions ?? []) createTransaction(t);
    for (const n of snapshot.notes ?? []) createNote(n);
    for (const l of snapshot.checklists ?? []) {
      db.prepare(
        "INSERT INTO checklists (id,title,createdAt,updatedAt) VALUES (?,?,?,?)",
      ).run(l.id, l.title, l.createdAt, l.updatedAt);
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
