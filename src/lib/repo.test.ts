import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SCHEMA_VERSION, backupIfDue, getDb, resetDbForTests } from "./db";
import {
  addChecklistItem,
  clearAll,
  createCategory,
  createChecklist,
  createTask,
  createTransaction,
  deleteCategory,
  getTask,
  getTransaction,
  listCategories,
  listChecklists,
  readAll,
  replaceAll,
  updateTask,
  updateTransaction,
} from "./repo";

beforeEach(() => {
  process.env.LIOR_DB_PATH = ":memory:";
  resetDbForTests();
});

describe("schema", () => {
  it("runs every migration on a fresh database", () => {
    const { user_version } = getDb().prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(user_version).toBe(SCHEMA_VERSION);
  });

  it("seeds the default categories once", () => {
    expect(listCategories()).toHaveLength(12);
    resetDbForTests();
    expect(listCategories()).toHaveLength(12);
  });
});

describe("tasks", () => {
  it("keeps an id chosen by the client", () => {
    createTask({ id: "client-id", title: "משימה" });
    expect(getTask("client-id")?.title).toBe("משימה");
  });

  // Clearing a field arrives as null (see json-body.ts). Before that fix the
  // key was dropped in transit, so restoring from the archive left the task
  // archived after a reload.
  it("clears fields that arrive as null", () => {
    const home = listCategories().find((c) => c.kind === "task")!;
    createTask({
      id: "t",
      title: "x",
      dueDate: "2026-09-28",
      categoryId: home.id,
      archivedAt: "2026-09-28T10:00:00.000Z",
    });
    const cleared = updateTask("t", {
      dueDate: null,
      categoryId: null,
      archivedAt: null,
    } as never);
    expect(cleared?.dueDate).toBeUndefined();
    expect(cleared?.categoryId).toBeUndefined();
    expect(cleared?.archivedAt).toBeUndefined();
  });

  it("leaves fields that are absent from the patch untouched", () => {
    createTask({ id: "t", title: "x", dueDate: "2026-09-28" });
    expect(updateTask("t", { title: "y" })?.dueDate).toBe("2026-09-28");
  });
});

describe("transactions", () => {
  it("round-trips per-month exceptions", () => {
    createTransaction({
      id: "rent",
      type: "expense",
      amount: 4500,
      description: "שכר דירה",
      date: "2026-09-01",
      recurring: { startMonth: "2026-09" },
    });
    updateTransaction("rent", {
      exceptions: [{ month: "2026-10", skip: true }],
    });
    expect(getTransaction("rent")?.exceptions).toEqual([
      { month: "2026-10", skip: true },
    ]);
  });

  it("stops recurring when recurring arrives as null", () => {
    createTransaction({
      id: "r",
      amount: 1,
      description: "x",
      date: "2026-09-01",
      recurring: { startMonth: "2026-09" },
    });
    updateTransaction("r", { recurring: null } as never);
    expect(getTransaction("r")?.recurring).toBeUndefined();
  });
});

describe("checklists", () => {
  it("keeps client ids for the list and its items", () => {
    createChecklist("קניות", [{ id: "i1", text: "שמן בישול" }], "list-1");
    addChecklistItem("list-1", "אקונומיקה", "i2");
    const [list] = listChecklists();
    expect(list.id).toBe("list-1");
    expect(list.items.map((i) => [i.id, i.text])).toEqual([
      ["i1", "שמן בישול"],
      ["i2", "אקונומיקה"],
    ]);
  });
});

describe("checklist undo", () => {
  it("re-inserts an item at a given index and keeps the order dense", () => {
    createChecklist("קניות", ["שמן", "לחם"], "l");
    addChecklistItem("l", "חלב", "milk", { index: 1, done: true });
    const [list] = listChecklists();
    expect(list.items.map((i) => [i.text, i.done])).toEqual([
      ["שמן", false],
      ["חלב", true],
      ["לחם", false],
    ]);
    // A later append still lands at the end.
    addChecklistItem("l", "ביצים");
    expect(listChecklists()[0].items.at(-1)?.text).toBe("ביצים");
  });
});

describe("categories", () => {
  it("unlinks items instead of deleting them", () => {
    const c = createCategory({
      id: "c1",
      name: "זמני",
      color: "teal",
      kind: "task",
    });
    createTask({ id: "t", title: "x", categoryId: c.id });
    deleteCategory(c.id);
    expect(getTask("t")?.categoryId).toBeUndefined();
  });
});

describe("backup round trip", () => {
  it("export → wipe → import restores the same data", () => {
    createTask({ id: "t1", title: "להחליף סיסמה", priority: "high" });
    createChecklist("קניות", ["שמן בישול", "אקונומיקה"], "l1");
    createTransaction({
      id: "x1",
      amount: 12000,
      type: "income",
      description: "משכורת",
      date: "2026-09-10",
      recurring: { startMonth: "2026-09" },
      exceptions: [{ month: "2026-12", amount: 15000 }],
    });

    const exported = JSON.parse(JSON.stringify(readAll()));
    const wiped = clearAll();
    expect(wiped.tasks).toHaveLength(0);
    expect(wiped.categories).toHaveLength(12); // re-seeded

    const restored = replaceAll(exported);
    const strip = (snapshot: typeof exported) => ({
      ...snapshot,
      exportedAt: undefined,
      tasks: snapshot.tasks.map((t: { updatedAt?: string }) => ({
        ...t,
        updatedAt: undefined,
      })),
    });
    expect(strip(JSON.parse(JSON.stringify(restored)))).toEqual(
      strip(exported),
    );
  });
});

describe("daily backup", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "lior-db-"));
    process.env.LIOR_DB_PATH = path.join(dir, "lior.db");
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes one snapshot per day next to the database", () => {
    getDb();
    const backups = path.join(dir, "backups");
    expect(readdirSync(backups)).toHaveLength(1);
    getDb();
    expect(readdirSync(backups)).toHaveLength(1);
  });

  it("keeps only the 14 most recent snapshots", () => {
    const db = getDb();
    const backups = path.join(dir, "backups");
    for (let day = 1; day <= 20; day++) {
      writeFileSync(
        path.join(backups, `lior-2026-08-${String(day).padStart(2, "0")}.db`),
        "",
      );
    }
    backupIfDue(db, "2026-09-30");
    const kept = readdirSync(backups).sort();
    expect(kept).toHaveLength(14);
    expect(kept.at(-1)).toBe("lior-2026-09-30.db");
    expect(existsSync(path.join(backups, "lior-2026-08-01.db"))).toBe(false);
  });

  it("skips in-memory databases", () => {
    process.env.LIOR_DB_PATH = ":memory:";
    resetDbForTests();
    expect(backupIfDue(getDb(), "2026-09-30")).toBeNull();
  });
});
