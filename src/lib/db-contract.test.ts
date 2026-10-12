import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./db";
import { setRepoDb, type Db, type SqlValue } from "./db-adapter";
import { nodeDb } from "./node-db";
import * as repo from "./repo";
import { BASE_SCHEMA, MIGRATIONS } from "./schema";
import type { DataSnapshot } from "./types";

/**
 * The same repo.ts scenarios on both adapters. "bridge" behaves the way
 * tauri-db.ts + src-tauri/src/db.rs do: every value crosses as JSON, and in a
 * batch a statement without params runs as a script — so anything that only
 * works because node:sqlite is in-process shows up here.
 */

function bridgeDb(): Db {
  const conn = new DatabaseSync(":memory:");
  conn.exec(BASE_SCHEMA);
  for (const migration of MIGRATIONS) conn.exec(migration);
  conn.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
  const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const args = (params?: SqlValue[]) => wire(params ?? []);
  return {
    async all<T>(sql: string, params?: SqlValue[]) {
      return wire(conn.prepare(sql).all(...args(params))) as T[];
    },
    async get<T>(sql: string, params?: SqlValue[]) {
      return wire(conn.prepare(sql).all(...args(params))[0] ?? null) as T | null;
    },
    async run(sql: string, params?: SqlValue[]) {
      conn.prepare(sql).run(...args(params));
    },
    async batch(statements) {
      const sent = wire(statements);
      conn.exec("BEGIN");
      try {
        for (const s of sent) {
          if (!s.params || s.params.length === 0) conn.exec(s.sql);
          else conn.prepare(s.sql).run(...s.params);
        }
        conn.exec("COMMIT");
      } catch (error) {
        conn.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const ADAPTERS: [string, () => Db][] = [
  [
    "node",
    () => {
      process.env.LIOR_DB_PATH = ":memory:";
      resetDbForTests();
      return nodeDb;
    },
  ],
  ["bridge", bridgeDb],
];

describe.each(ADAPTERS)("repo.ts on %s", (_name, make) => {
  beforeEach(() => {
    setRepoDb(make());
  });

  it("creates, edits and deletes a task, keeping every field", async () => {
    await repo.createTask({
      id: "t",
      title: "מעבר דירה",
      dueDate: "2026-10-12",
      dueTime: "09:30",
      priority: "high",
      reminder: 15,
      subtasks: [{ id: "s", text: "קרטונים", done: false }],
    });
    const done = await repo.updateTask("t", {
      completed: true,
      completedAt: "2026-10-12T10:00:00.000Z",
      position: 2.5,
    });
    expect(done).toMatchObject({
      title: "מעבר דירה",
      dueTime: "09:30",
      priority: "high",
      reminder: 15,
      completed: true,
      position: 2.5,
      subtasks: [{ id: "s", text: "קרטונים", done: false }],
    });

    await repo.updateTask("t", { dueTime: undefined, subtasks: [] });
    const cleared = await repo.getTask("t");
    expect(cleared?.dueTime).toBeUndefined();
    expect(cleared?.subtasks).toBeUndefined();

    await repo.deleteTask("t");
    expect(await repo.getTask("t")).toBeNull();
  });

  it("saves an import all or nothing", async () => {
    const row = (id: string) => ({
      id,
      type: "expense" as const,
      amount: 12.5,
      description: id,
      date: "2026-10-01",
    });
    await repo.createTransactions([row("a"), row("b")]);
    await expect(repo.createTransactions([row("c"), row("a")])).rejects.toThrow();
    expect((await repo.listTransactions()).map((t) => t.id).sort()).toEqual([
      "a",
      "b",
    ]);
    expect((await repo.getTransaction("a"))?.amount).toBe(12.5);
  });

  it("restores a deleted list item to its old place", async () => {
    await repo.createChecklist("קניות", [
      { id: "1", text: "חלב" },
      { id: "2", text: "לחם" },
      { id: "3", text: "ביצים" },
    ]);
    const list = (await repo.listChecklists())[0];
    await repo.deleteChecklistItem(list.id, "2");
    await repo.addChecklistItem(list.id, "לחם", "2", { index: 1, done: true });
    const items = (await repo.getChecklist(list.id))!.items;
    expect(items.map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(items[1].done).toBe(true);
  });

  it("reads back exactly the snapshot it was given", async () => {
    const snapshot: Partial<DataSnapshot> = {
      categories: [{ id: "c", name: "בית", color: "amber", kind: "task" }],
      tasks: [
        {
          id: "t",
          title: "לשלם חשמל",
          priority: "normal",
          categoryId: "c",
          completed: false,
          createdAt: "2026-10-01T08:00:00.000Z",
          updatedAt: "2026-10-01T08:00:00.000Z",
        },
      ],
      events: [
        {
          id: "e",
          title: "רופא",
          date: "2026-10-14",
          startTime: "10:00",
          allDay: false,
          color: "sky",
          repeat: { kind: "weekly", days: [3] },
          createdAt: "2026-10-01T08:00:00.000Z",
        } as never,
      ],
      notes: [
        {
          id: "n",
          title: "רעיון",
          body: "",
          pinned: true,
          createdAt: "2026-10-01T08:00:00.000Z",
          updatedAt: "2026-10-01T08:00:00.000Z",
        },
      ],
      checklists: [
        {
          id: "l",
          title: "קניות",
          pinned: false,
          items: [{ id: "i", text: "חלב", done: true }],
          createdAt: "2026-10-01T08:00:00.000Z",
          updatedAt: "2026-10-01T08:00:00.000Z",
        },
      ],
      links: [
        { id: "k", aKind: "task", aId: "t", bKind: "note", bId: "n", createdAt: "2026-10-01T08:00:00.000Z" },
        { id: "k2", aKind: "note", aId: "n", bKind: "task", bId: "t", createdAt: "2026-10-01T08:00:00.000Z" },
      ],
      settings: {
        startMonth: "2026-01",
        budgets: { c: 500 },
        prefs: { currency: "ILS" } as never,
      },
    };
    const saved = await repo.replaceAll(snapshot);
    // An import stamps updatedAt anew, as it always has; the rest comes back.
    const { updatedAt: _stamped, ...task } = snapshot.tasks![0];
    void _stamped;
    expect(saved.tasks).toMatchObject([task]);
    expect(saved.events[0]).toMatchObject({ id: "e", repeat: { kind: "weekly", days: [3] } });
    expect(saved.notes[0].pinned).toBe(true);
    expect(saved.checklists[0].items).toEqual([{ id: "i", text: "חלב", done: true }]);
    // The same pair linked twice is one link.
    expect(saved.links?.map((l) => l.id)).toEqual(["k"]);
    expect(saved.settings).toMatchObject({
      startMonth: "2026-01",
      budgets: { c: 500 },
      prefs: { currency: "ILS" },
    });
  });

  it("puts the defaults back after a wipe", async () => {
    await repo.createTask({ title: "x" });
    const wiped = await repo.clearAll();
    expect(wiped.tasks).toEqual([]);
    expect(wiped.categories).toHaveLength(12);
    expect(wiped.settings.startMonth).toMatch(/^\d{4}-\d{2}$/);
  });
});
