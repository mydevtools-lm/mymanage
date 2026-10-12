"use client";

import type { DataSnapshot, Settings, Subtask, Task } from "./types";
import { openLocalDb, sql, type Param, type Row } from "./tauri-db";

/**
 * Spike (sprint ד0): the desktop app's stand-in for the /api routes, covering
 * the load and tasks only. Sprint ד1 replaces it with the real repo.ts running
 * on either database, so nothing here is meant to grow.
 */

function parseJson<T>(raw: Param): T | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function toTask(r: Row): Task {
  const subtasks = parseJson<Subtask[]>(r.subtasks);
  const opt = <T>(v: Param) => (v ?? undefined) as T | undefined;
  return {
    id: r.id as string,
    title: r.title as string,
    description: opt(r.description),
    dueDate: opt(r.dueDate),
    dueTime: opt(r.dueTime),
    priority: r.priority as Task["priority"],
    categoryId: opt(r.categoryId),
    completed: !!r.completed,
    completedAt: opt(r.completedAt),
    archivedAt: opt(r.archivedAt),
    routineId: opt(r.routineId),
    subtasks: subtasks?.length ? subtasks : undefined,
    position: opt(r.position),
    reminder: opt(r.reminder),
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string,
  };
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

function taskValue(field: string, value: unknown): Param {
  if (field === "completed") return value ? 1 : 0;
  if (field === "subtasks") {
    const list = value as Subtask[] | null | undefined;
    return list && list.length > 0 ? JSON.stringify(list) : null;
  }
  return (value as Param | undefined) ?? null;
}

async function getTask(id: string) {
  const r = await sql.get("SELECT * FROM tasks WHERE id = ?", [id]);
  return r ? toTask(r) : null;
}

async function createTask(input: Partial<Task>) {
  const id = input.id ?? crypto.randomUUID();
  const stamp = new Date().toISOString();
  await sql.run(
    `INSERT INTO tasks
     (id,title,description,dueDate,dueTime,priority,categoryId,completed,completedAt,archivedAt,routineId,subtasks,position,reminder,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
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
      taskValue("subtasks", input.subtasks),
      input.position ?? null,
      input.reminder ?? null,
      input.createdAt ?? stamp,
      stamp,
    ],
  );
  return getTask(id);
}

async function updateTask(id: string, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const values: Param[] = [];
  for (const field of TASK_FIELDS) {
    if (!(field in patch)) continue;
    sets.push(`${field} = ?`);
    values.push(taskValue(field, patch[field]));
  }
  if (sets.length > 0) {
    sets.push("updatedAt = ?");
    values.push(new Date().toISOString(), id);
    await sql.run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, values);
  }
  return getTask(id);
}

async function setting(key: string) {
  const r = await sql.get<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return r?.value;
}

async function readAll(): Promise<DataSnapshot> {
  const tasks = (await sql.all("SELECT * FROM tasks ORDER BY createdAt")).map(
    toTask,
  );
  const categories = await sql.all("SELECT * FROM categories ORDER BY kind, name");
  const settings: Settings = {
    startMonth: (await setting("startMonth")) ?? new Date().toISOString().slice(0, 7),
    calendars: parseJson(await setting("calendars") ?? null) ?? {},
    budgets: parseJson(await setting("budgets") ?? null) ?? {},
    prefs: parseJson(await setting("prefs") ?? null) ?? {},
  };
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    events: [],
    transactions: [],
    notes: [],
    checklists: [],
    routines: [],
    links: [],
    categories: categories as unknown as DataSnapshot["categories"],
    settings,
  };
}

/** Same contract as the server's /api: resolves with the JSON body or throws. */
export async function localApi(url: string, method: string, body?: unknown) {
  await openLocalDb();
  const path = url.replace(/\?.*$/, "");
  const input = (body ?? {}) as Record<string, unknown>;

  if (path === "/api/data" && method === "GET") return readAll();
  if (path === "/api/tasks" && method === "POST") return createTask(input);
  if (path === "/api/tasks/reorder" && method === "POST") {
    const ids = (input.ids as string[]) ?? [];
    await sql.batch(
      ids.map((id, index) => ({
        sql: "UPDATE tasks SET position = ? WHERE id = ?",
        params: [index, id],
      })),
    );
    return { ok: true };
  }
  const task = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (task && method === "PATCH") return updateTask(task[1], input);
  if (task && method === "DELETE") {
    await sql.run("DELETE FROM tasks WHERE id = ?", [task[1]]);
    return { ok: true };
  }

  // Not part of the spike: say so in the console instead of failing the UI.
  console.warn(`[ד0] ${method} ${path} עוד לא נתמך באפליקציית הדסקטופ`);
  return {};
}
