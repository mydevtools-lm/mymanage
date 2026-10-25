import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setRepoDb, type Db, type SqlValue } from "../db-adapter";
import { BASE_SCHEMA, MIGRATIONS } from "../schema";
import * as repo from "../repo";
import { disableSync, enableSync, syncOnce, syncStatus } from "./engine";
import { nodeFolder } from "./node-folder";
import { SYNC_DIR } from "./files";
import type { SyncFolder, SyncResult } from "./types";

/**
 * Two (or three) computers, each with a database of its own, one shared
 * folder. Edits go through repo.ts, so the triggers see what the app would
 * write; the clocks are set by hand, so skew is something a test can state.
 */

class Computer {
  readonly sql = new DatabaseSync(":memory:");
  readonly db: Db;
  clock: number;

  constructor(startMs: number) {
    this.clock = startMs;
    this.sql.exec(BASE_SCHEMA);
    MIGRATIONS.forEach((m, i) => {
      this.sql.exec(m);
      this.sql.exec(`PRAGMA user_version = ${i + 1}`);
    });
    const sql = this.sql;
    this.db = {
      async all<T>(q: string, params: SqlValue[] = []) {
        return sql.prepare(q).all(...params) as T[];
      },
      async get<T>(q: string, params: SqlValue[] = []) {
        return (sql.prepare(q).get(...params) ?? null) as T | null;
      },
      async run(q: string, params: SqlValue[] = []) {
        sql.prepare(q).run(...params);
      },
      async batch(statements) {
        sql.exec("BEGIN");
        try {
          for (const { sql: q, params } of statements) {
            if (params) sql.prepare(q).run(...params);
            else sql.exec(q);
          }
          sql.exec("COMMIT");
        } catch (error) {
          sql.exec("ROLLBACK");
          throw error;
        }
      },
    };
  }

  /** Runs repo code against this computer, at this computer's time. */
  async do<T>(fn: () => Promise<T>, at?: number): Promise<T> {
    if (at !== undefined) this.clock = at;
    this.sql
      .prepare("INSERT OR REPLACE INTO _sync_meta (k, v) VALUES ('now', ?)")
      .run(String(this.clock));
    setRepoDb(this.db);
    return fn();
  }

  async on() {
    this.sql
      .prepare("INSERT OR REPLACE INTO _sync_meta (k, v) VALUES ('now', ?)")
      .run(String(this.clock));
    return enableSync(this.db, () => this.clock);
  }

  sync(
    folder: SyncFolder,
    options: { compactAfter?: number; at?: number } = {},
  ) {
    if (options.at !== undefined) this.clock = options.at;
    return syncOnce(this.db, folder, {
      now: () => this.clock,
      compactAfter: options.compactAfter,
    });
  }

  rows(table: string, key = "id") {
    return this.sql.prepare(`SELECT * FROM ${table} ORDER BY ${key}`).all();
  }
}

let root: string;
let folder: SyncFolder;
const T0 = 1_800_000_000_000;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "mymanage-sync-"));
  folder = nodeFolder(root);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const TABLES = [
  "categories",
  "tasks",
  "events",
  "transactions",
  "notes",
  "checklists",
  "checklist_items",
  "routines",
  "links",
];
const same = (a: Computer, b: Computer) => {
  for (const t of TABLES) expect(a.rows(t), t).toEqual(b.rows(t));
  expect(a.rows("settings", "key")).toEqual(b.rows("settings", "key"));
};

/** Both computers write and read until neither has anything new. */
async function settle(...computers: Computer[]) {
  for (let round = 0; round < 3; round++) {
    for (const c of computers) await c.sync(folder);
  }
}

async function pair() {
  const a = new Computer(T0);
  const b = new Computer(T0);
  await a.on();
  await b.on();
  return { a, b };
}

describe("watching", () => {
  it("records nothing until sync is on", async () => {
    const a = new Computer(T0);
    await a.do(() => repo.createTask({ title: "before" }));
    expect(a.rows("_sync_out", "seq")).toEqual([]);
    await a.on();
    // Turning it on puts what is already there into the outbox.
    expect(a.rows("_sync_out", "seq")).toHaveLength(1);
    await disableSync(a.db);
    await a.do(() => repo.createTask({ title: "after" }));
    expect(a.rows("_sync_out", "seq")).toEqual([]);
  });

  it("records a row, a changed field, and a delete — only what changed", async () => {
    const a = new Computer(T0);
    await a.on();
    const task = await a.do(() => repo.createTask({ title: "Buy milk" }));
    await a.do(
      () => repo.updateTask(task.id, { title: "Buy oat milk" }),
      T0 + 10,
    );
    await a.do(() => repo.deleteTask(task.id), T0 + 20);
    const out = a.sql
      .prepare("SELECT op, c, v FROM _sync_out ORDER BY seq")
      .all() as { op: string; c: string | null; v: string }[];
    expect(out.map((o) => o.op)).toEqual(["ins", "set", "set", "del"]);
    const sets = out.filter((o) => o.op === "set");
    expect(sets.map((s) => s.c).sort()).toEqual(["title", "updatedAt"]);
    expect(JSON.parse(sets.find((s) => s.c === "title")!.v)).toBe(
      "Buy oat milk",
    );
  });

  it("keeps the logical clock moving even when the wall clock stands still", async () => {
    const a = new Computer(T0);
    await a.on();
    await a.do(() => repo.createTask({ title: "one" }), T0);
    await a.do(() => repo.createTask({ title: "two" }), T0);
    const l = (
      a.sql.prepare("SELECT l FROM _sync_out ORDER BY seq").all() as {
        l: number;
      }[]
    ).map((x) => x.l);
    expect(new Set(l).size).toBe(l.length);
    expect([...l].sort((x, y) => x - y)).toEqual(l);
  });
});

describe("two computers", () => {
  it("a task made on one appears on the other, unchanged", async () => {
    const { a, b } = await pair();
    const task = await a.do(() =>
      repo.createTask({
        title: "Call the plumber",
        dueDate: "2026-11-02",
        priority: "high",
      }),
    );
    await settle(a, b);
    same(a, b);
    expect(b.rows("tasks")).toMatchObject([
      { id: task.id, title: "Call the plumber" },
    ]);
  });

  it("changes to different fields of one row both survive", async () => {
    const { a, b } = await pair();
    const task = await a.do(() => repo.createTask({ title: "Plan trip" }));
    await settle(a, b);
    await a.do(
      () => repo.updateTask(task.id, { title: "Plan the trip" }),
      T0 + 1000,
    );
    await b.do(
      () => repo.updateTask(task.id, { dueDate: "2026-12-24" }),
      T0 + 1500,
    );
    await settle(a, b);
    same(a, b);
    expect(a.rows("tasks")[0]).toMatchObject({
      title: "Plan the trip",
      dueDate: "2026-12-24",
    });
  });

  it("on the same field the later change wins, on both", async () => {
    const { a, b } = await pair();
    const task = await a.do(() => repo.createTask({ title: "x" }));
    await settle(a, b);
    await a.do(() => repo.updateTask(task.id, { title: "from A" }), T0 + 2000);
    await b.do(() => repo.updateTask(task.id, { title: "from B" }), T0 + 3000);
    await settle(a, b);
    same(a, b);
    expect(a.rows("tasks")[0]).toMatchObject({ title: "from B" });
  });

  it("a computer whose clock is an hour slow still wins after reading what it overwrites", async () => {
    const { a, b } = await pair();
    const task = await a.do(() => repo.createTask({ title: "x" }));
    await settle(a, b);
    const HOUR = 3_600_000;
    await a.do(
      () => repo.updateTask(task.id, { title: "A, by its fast clock" }),
      T0 + 5 * HOUR,
    );
    await a.sync(folder);
    // B reads it, then edits — by a clock that says it is an hour earlier.
    await b.sync(folder, { at: T0 + 4 * HOUR });
    await b.do(
      () => repo.updateTask(task.id, { title: "B, after reading A" }),
      T0 + 4 * HOUR,
    );
    await settle(a, b);
    same(a, b);
    expect(a.rows("tasks")[0]).toMatchObject({ title: "B, after reading A" });
  });

  it("syncing again changes nothing", async () => {
    const { a, b } = await pair();
    await a.do(() => repo.createTask({ title: "once" }));
    await settle(a, b);
    const before = JSON.stringify([a.rows("tasks"), b.rows("tasks")]);
    const again = await b.sync(folder);
    expect(again).toMatchObject({ exported: 0, changed: false });
    await a.sync(folder);
    expect(JSON.stringify([a.rows("tasks"), b.rows("tasks")])).toBe(before);
  });
});

describe("deleting", () => {
  it("a deleted row stays deleted, even if another computer edited it meanwhile", async () => {
    const { a, b } = await pair();
    const task = await a.do(() => repo.createTask({ title: "gone" }));
    await settle(a, b);
    await a.do(() => repo.deleteTask(task.id), T0 + 1000);
    await b.do(() => repo.updateTask(task.id, { title: "edited" }), T0 + 2000);
    await settle(a, b);
    expect(a.rows("tasks")).toEqual([]);
    expect(b.rows("tasks")).toEqual([]);
    // The edit had nothing left to land on: it is dropped, not kept waiting.
    expect((await syncStatus(a.db)).pending).toBe(0);
    expect((await syncStatus(b.db)).pending).toBe(0);
  });

  it("undoing a delete (the same row made again) brings it back everywhere", async () => {
    const { a, b } = await pair();
    const task = await a.do(() => repo.createTask({ title: "again" }));
    await settle(a, b);
    await a.do(() => repo.deleteTask(task.id), T0 + 1000);
    await settle(a, b);
    expect(b.rows("tasks")).toEqual([]);
    await a.do(
      () => repo.createTask({ id: task.id, title: "again" }),
      T0 + 2000,
    );
    await settle(a, b);
    expect(b.rows("tasks")).toMatchObject([{ id: task.id, title: "again" }]);
    same(a, b);
  });

  it("deleting a list takes its items on every computer", async () => {
    const { a, b } = await pair();
    const list = await a.do(() =>
      repo.createChecklist("Groceries", ["Milk", "Bread"]),
    );
    await settle(a, b);
    expect(b.rows("checklist_items")).toHaveLength(2);
    await a.do(() => repo.deleteChecklist(list.id), T0 + 1000);
    await settle(a, b);
    expect(b.rows("checklists")).toEqual([]);
    expect(b.rows("checklist_items")).toEqual([]);
  });

  it("deleting a category leaves the tasks, without it, on both", async () => {
    const { a, b } = await pair();
    const cat = await a.do(() =>
      repo.createCategory({ name: "Work", color: "teal", kind: "task" }),
    );
    const task = await a.do(() =>
      repo.createTask({ title: "t", categoryId: cat.id }),
    );
    await settle(a, b);
    expect(b.rows("tasks")[0]).toMatchObject({ categoryId: cat.id });
    await a.do(() => repo.deleteCategory(cat.id), T0 + 1000);
    await settle(a, b);
    expect(b.rows("categories")).toEqual([]);
    expect(b.rows("tasks")).toMatchObject([{ id: task.id, categoryId: null }]);
  });
});

describe("what arrives out of order or incomplete", () => {
  it("a file that isn't whole yet is left for the next round", async () => {
    const { a, b } = await pair();
    await a.do(() => repo.createTask({ title: "slow upload" }));
    await a.sync(folder);
    const dir = path.join(
      root,
      SYNC_DIR,
      (
        (await a.sql
          .prepare("SELECT v FROM _sync_meta WHERE k='dev'")
          .get()) as { v: string }
      ).v,
    );
    const [seg] = (await readdir(dir)).filter((n) => n.startsWith("seg-"));
    const whole = await readFile(path.join(dir, seg), "utf8");
    await writeFile(path.join(dir, seg), whole.slice(0, whole.length / 2));

    const early = await b.sync(folder);
    expect(early.waiting).toHaveLength(1);
    expect(b.rows("tasks")).toEqual([]);

    await writeFile(path.join(dir, seg), whole);
    const late = await b.sync(folder);
    expect(late.waiting).toEqual([]);
    expect(b.rows("tasks")).toHaveLength(1);
  });

  it("a file whose contents were damaged is not applied", async () => {
    const { a, b } = await pair();
    await a.do(() => repo.createTask({ title: "intact" }));
    await a.sync(folder);
    const dev = (
      a.sql.prepare("SELECT v FROM _sync_meta WHERE k='dev'").get() as {
        v: string;
      }
    ).v;
    const dir = path.join(root, SYNC_DIR, dev);
    const [seg] = (await readdir(dir)).filter((n) => n.startsWith("seg-"));
    const text = await readFile(path.join(dir, seg), "utf8");
    await writeFile(path.join(dir, seg), text.replace("intact", "tampered"));
    const result = await b.sync(folder);
    expect(result.waiting).toHaveLength(1);
    expect(b.rows("tasks")).toEqual([]);
  });

  it("a file missing in the middle holds back what comes after it", async () => {
    const { a, b } = await pair();
    await a.do(() => repo.createTask({ title: "first" }));
    await a.sync(folder);
    await a.do(() => repo.createTask({ title: "second" }), T0 + 100);
    await a.sync(folder);
    await a.do(() => repo.createTask({ title: "third" }), T0 + 200);
    await a.sync(folder);
    const dev = (
      a.sql.prepare("SELECT v FROM _sync_meta WHERE k='dev'").get() as {
        v: string;
      }
    ).v;
    const dir = path.join(root, SYNC_DIR, dev);
    const segs = (await readdir(dir))
      .filter((n) => n.startsWith("seg-"))
      .sort();
    expect(segs).toHaveLength(3);
    const second = await readFile(path.join(dir, segs[1]), "utf8");
    await rm(path.join(dir, segs[1]));

    const early = await b.sync(folder);
    expect(early.waiting.length).toBeGreaterThan(0);
    expect(b.rows("tasks").map((t) => (t as { title: string }).title)).toEqual([
      "first",
    ]);

    await writeFile(path.join(dir, segs[1]), second);
    await b.sync(folder);
    expect(b.rows("tasks")).toHaveLength(3);
  });

  it("a change to a row that hasn't arrived waits, then lands", async () => {
    const a = new Computer(T0);
    const b = new Computer(T0);
    const c = new Computer(T0);
    for (const x of [a, b, c]) await x.on();
    // C makes a task; A reads it and edits it; B reads only A's file.
    const task = await c.do(() => repo.createTask({ title: "from C" }));
    await c.sync(folder);
    await a.sync(folder);
    await a.do(
      () => repo.updateTask(task.id, { title: "edited by A" }),
      T0 + 1000,
    );
    await a.sync(folder);

    const hidden = path.join(root, SYNC_DIR);
    const cDev = (
      c.sql.prepare("SELECT v FROM _sync_meta WHERE k='dev'").get() as {
        v: string;
      }
    ).v;
    const onlyA: SyncFolder = {
      ...folder,
      list: async (dir) => (await folder.list(dir)).filter((n) => n !== cDev),
    };
    void hidden;
    const first = await b.sync(onlyA);
    // The title and the updatedAt stamp: two changes, both waiting.
    expect(first.pending).toBe(2);
    expect(b.rows("tasks")).toEqual([]);

    await b.sync(folder);
    expect(b.rows("tasks")).toMatchObject([
      { id: task.id, title: "edited by A" },
    ]);
    const status = await syncStatus(b.db);
    expect(status.pending).toBe(0);
  });

  it("a task that points at a category from another computer waits for the category", async () => {
    const a = new Computer(T0);
    const b = new Computer(T0);
    await a.on();
    await b.on();
    const cat = await a.do(() =>
      repo.createCategory({ name: "Errands", color: "sky", kind: "task" }),
    );
    await a.do(
      () => repo.createTask({ title: "needs it", categoryId: cat.id }),
      T0 + 10,
    );
    await a.sync(folder);
    await b.sync(folder);
    same(a, b);
  });
});

describe("joining", () => {
  it("two computers that each already had data end up with both, without duplicates", async () => {
    const a = new Computer(T0);
    const b = new Computer(T0);
    await a.do(() => repo.createTask({ title: "only on A" }));
    await b.do(() => repo.createTask({ title: "only on B" }));
    await a.do(() => repo.createChecklist("Shopping", ["Eggs"]));
    await a.on();
    await b.on();
    await settle(a, b);
    same(a, b);
    expect(a.rows("tasks")).toHaveLength(2);
    expect(a.rows("checklist_items")).toHaveLength(1);
  });

  it("the same database copied to a second computer doesn't double or undo anything", async () => {
    const a = new Computer(T0);
    const task = await a.do(() =>
      repo.createTask({ title: "shared", dueDate: "2026-11-01" }),
    );
    const copy = await a.do(() => repo.readAll());
    const b = new Computer(T0 + 5000);
    await b.do(() => repo.replaceAll(copy));
    await a.on();
    await b.on();
    // A edits after the copy was taken; B joins later with the old copy.
    await a.do(
      () => repo.updateTask(task.id, { title: "newer on A" }),
      T0 + 60_000,
    );
    await settle(a, b);
    same(a, b);
    expect(b.rows("tasks")).toMatchObject([{ title: "newer on A" }]);
  });

  it("the default categories made on both computers become one set, and tasks follow", async () => {
    const a = new Computer(T0);
    const b = new Computer(T0);
    await a.do(() =>
      repo.createCategory({ name: "Work", color: "teal", kind: "task" }),
    );
    await b.do(() =>
      repo.createCategory({ name: "Work", color: "teal", kind: "task" }),
    );
    const onB = (await b.do(() => repo.listCategories()))[0];
    const taskOnB = await b.do(() =>
      repo.createTask({ title: "on B", categoryId: onB.id }),
    );
    await a.on();
    await b.on();
    await settle(a, b);
    expect(a.rows("categories")).toHaveLength(1);
    expect(b.rows("categories")).toHaveLength(1);
    const onA = (a.rows("categories")[0] as { id: string }).id;
    expect(a.rows("tasks")).toMatchObject([
      { id: taskOnB.id, categoryId: onA },
    ]);
    expect(b.rows("tasks")).toMatchObject([
      { id: taskOnB.id, categoryId: onB.id },
    ]);
    // A rename on one reaches the other, through the shared identity.
    await a.do(() => repo.updateCategory(onA, { name: "Job" }), T0 + 9000);
    await settle(a, b);
    expect(b.rows("categories")).toMatchObject([{ id: onB.id, name: "Job" }]);
  });

  it("budgets follow the category across computers", async () => {
    const a = new Computer(T0);
    const b = new Computer(T0);
    const onA = await a.do(() =>
      repo.createCategory({ name: "Food", color: "amber", kind: "finance" }),
    );
    const onB = await b.do(() =>
      repo.createCategory({ name: "Food", color: "amber", kind: "finance" }),
    );
    await a.on();
    await b.on();
    await a.do(() => repo.setBudgets({ [onA.id]: 800 }), T0 + 1000);
    await settle(a, b);
    expect(await b.do(() => repo.getBudgets())).toEqual({ [onB.id]: 800 });
  });

  it("settings follow too, the later write winning as a whole", async () => {
    const { a, b } = await pair();
    await a.do(() => repo.setPrefs({ userName: "Dana" }), T0 + 10);
    await b.do(() => repo.setPrefs({ weekStart: 1 }), T0 + 20);
    await settle(a, b);
    // Preferences are one setting: the later write is the one kept.
    expect(await b.do(() => repo.getPrefs())).toEqual(
      await a.do(() => repo.getPrefs()),
    );
  });

  it("restoring a backup on one computer replaces the data on the other", async () => {
    const { a, b } = await pair();
    await a.do(() => repo.createTask({ title: "old 1" }));
    await a.do(() => repo.createTask({ title: "old 2" }), T0 + 10);
    await settle(a, b);
    await a.do(
      () =>
        repo.replaceAll({
          tasks: [
            {
              id: "restored",
              title: "restored",
              createdAt: "2026-10-01T00:00:00.000Z",
              updatedAt: "2026-10-01T00:00:00.000Z",
              priority: "normal",
              completed: false,
            },
          ],
        }),
      T0 + 5000,
    );
    await settle(a, b);
    expect(b.rows("tasks")).toMatchObject([{ id: "restored" }]);
  });

  it("makes a copy before it first merges what another computer wrote", async () => {
    const { a, b } = await pair();
    await a.do(() => repo.createTask({ title: "x" }));
    await a.sync(folder);
    let copies = 0;
    const options = {
      now: () => T0,
      beforeFirstMerge: async () => void copies++,
    };
    await syncOnce(b.db, folder, options);
    await syncOnce(b.db, folder, options);
    expect(copies).toBe(1);
  });
});

describe("keeping the folder small", () => {
  async function edits(a: Computer, count: number, start = 0) {
    const task =
      start === 0 ? await a.do(() => repo.createTask({ title: "n0" })) : null;
    for (let i = 1; i <= count; i++) {
      const id = task?.id ?? (a.rows("tasks")[0] as { id: string }).id;
      await a.do(
        () => repo.updateTask(id, { title: `n${start + i}` }),
        T0 + (start + i) * 1000,
      );
      await a.sync(folder, { compactAfter: 6, at: T0 + (start + i) * 1000 });
    }
  }
  const files = async (c: Computer) => {
    const dev = (
      c.sql.prepare("SELECT v FROM _sync_meta WHERE k='dev'").get() as {
        v: string;
      }
    ).v;
    return (await readdir(path.join(root, SYNC_DIR, dev))).sort();
  };

  it("a snapshot replaces the older files, and a new computer still gets everything", async () => {
    const { a } = await pair();
    await a.do(() => repo.createChecklist("List", ["a", "b"]));
    await edits(a, 12);
    const list = await files(a);
    expect(list.some((n) => n.startsWith("snap-"))).toBe(true);
    expect(list.filter((n) => n.startsWith("seg-")).length).toBeLessThan(6);

    const fresh = new Computer(T0);
    await fresh.on();
    await fresh.sync(folder);
    same(a, fresh);
    expect(fresh.rows("tasks")).toMatchObject([{ title: "n12" }]);
  });

  it("a computer that was off for a week catches up from a snapshot", async () => {
    const { a, b } = await pair();
    await a.do(() => repo.createTask({ title: "n0" }));
    await settle(a, b);
    // B goes quiet while A edits and compacts, twice over.
    const id = (a.rows("tasks")[0] as { id: string }).id;
    for (let i = 1; i <= 30; i++) {
      await a.do(
        () => repo.updateTask(id, { title: `n${i}`, description: `d${i}` }),
        T0 + i * 1000,
      );
      await a.sync(folder, { compactAfter: 5, at: T0 + i * 1000 });
    }
    await a.do(
      () => repo.createTask({ title: "made while B was off" }),
      T0 + 40_000,
    );
    await a.sync(folder, { compactAfter: 5, at: T0 + 40_000 });
    await b.sync(folder, { at: T0 + 7 * 24 * 3_600_000 });
    same(a, b);
    expect(b.rows("tasks")).toHaveLength(2);
  });

  it("what another computer changed is kept through this one's snapshot", async () => {
    const { a, b } = await pair();
    const task = await a.do(() => repo.createTask({ title: "x" }));
    await settle(a, b);
    await b.do(
      () => repo.updateTask(task.id, { title: "set by B" }),
      T0 + 1000,
    );
    await settle(a, b);
    // A compacts; its snapshot must not bring back the old title.
    for (let i = 0; i < 8; i++) {
      await a.do(
        () => repo.createTask({ title: `filler ${i}` }),
        T0 + 2000 + i,
      );
      await a.sync(folder, { compactAfter: 3, at: T0 + 2000 + i });
    }
    const c = new Computer(T0);
    await c.on();
    await settle(a, b, c);
    expect(
      c.rows("tasks").find((t) => (t as { id: string }).id === task.id),
    ).toMatchObject({ title: "set by B" });
    same(a, b);
    same(a, c);
  });
});

describe("the watch list", () => {
  it("names every column of every synchronised table", async () => {
    const { SYNC_TABLES } = await import("./tables");
    const c = new Computer(T0);
    for (const table of SYNC_TABLES) {
      const columns = (
        c.sql.prepare(`PRAGMA table_info(${table.name})`).all() as {
          name: string;
        }[]
      )
        .map((x) => x.name)
        .filter((n) => n !== table.key)
        .sort();
      expect(
        table.columns.slice().sort(),
        `${table.name}: add the new column to SYNC_TABLES and create the triggers again in a new migration`,
      ).toEqual(columns);
    }
  });

  it("reports what is waiting and when it last ran", async () => {
    const { a } = await pair();
    expect(await syncStatus(a.db)).toMatchObject({ on: true, outbox: 0 });
    await a.do(() => repo.createTask({ title: "x" }));
    expect((await syncStatus(a.db)).outbox).toBeGreaterThan(0);
    const result: SyncResult = await a.sync(folder);
    expect(result.exported).toBeGreaterThan(0);
    const status = await syncStatus(a.db);
    expect(status.outbox).toBe(0);
    expect(status.lastSync).toBe(a.clock);
  });
});
