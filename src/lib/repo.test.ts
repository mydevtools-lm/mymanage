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
  createNote,
  getNote,
  listNotes,
  reorderChecklistItems,
  resetChecklist,
  setChecklistPinned,
  updateNote,
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
  createRoutine,
  deleteRoutine,
  ensureRoutineCopies,
  listRoutines,
  listTasks,
  reorderTasks,
  updateRoutine,
  createEvent,
  getEvent,
  updateEvent,
  getCalendarPrefs,
  setCalendarPrefs,
  getBudgets,
  setBudgets,
  createTransactions,
  deleteTransactions,
  listTransactions,
  createLink,
  deleteLink,
  listLinks,
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

describe("lists and notes (מ7)", () => {
  it("resets a list: every item unticked, nothing removed", () => {
    createChecklist("קניות", ["שמן", "חלב"], "l");
    const [first] = listChecklists()[0].items;
    addChecklistItem("l", "לחם", "bread", { done: true });
    resetChecklist("l");
    const items = listChecklists()[0].items;
    expect(items).toHaveLength(3);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(items[0].id).toBe(first.id);
  });

  it("stores a new item order and keeps unknown ids out", () => {
    createChecklist(
      "x",
      [
        { id: "a", text: "a" },
        { id: "b", text: "b" },
        { id: "c", text: "c" },
      ],
      "l",
    );
    reorderChecklistItems("l", ["c", "a", "nope"]);
    expect(listChecklists()[0].items.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("lists pinned lists first, then newest — not by last tick", () => {
    createChecklist("old", [], "old");
    createChecklist("new", [{ id: "n1", text: "x" }], "new");
    // Ticking an item in the old list must not move it above the new one.
    addChecklistItem("old", "y");
    expect(listChecklists().map((l) => l.id)).toEqual(["new", "old"]);
    setChecklistPinned("old", true);
    expect(listChecklists().map((l) => l.id)).toEqual(["old", "new"]);
  });

  it("pins and colours a note without touching its updated date", () => {
    createNote({
      id: "n",
      title: "t",
      body: "b",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    updateNote("n", { pinned: true, color: "amber" } as never);
    const note = getNote("n")!;
    expect(note.pinned).toBe(true);
    expect(note.color).toBe("amber");
    expect(note.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    updateNote("n", { body: "changed" });
    expect(getNote("n")!.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("lists pinned notes first", () => {
    createNote({ id: "a", title: "a", body: "" });
    createNote({ id: "b", title: "b", body: "" });
    updateNote("a", { pinned: true } as never);
    expect(listNotes()[0].id).toBe("a");
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

describe("routines", () => {
  const pills = {
    id: "r1",
    title: "כדורים",
    repeat: { kind: "daily" as const },
    startDate: "2026-09-27",
    dueTime: "08:00",
  };

  it("makes one copy for today, however often it is asked", () => {
    createRoutine(pills);
    expect(ensureRoutineCopies("2026-09-28")).toHaveLength(1);
    expect(ensureRoutineCopies("2026-09-28")).toHaveLength(0);

    const copies = listTasks().filter((t) => t.routineId === "r1");
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      id: "r1_2026-09-28",
      title: "כדורים",
      dueDate: "2026-09-28",
      dueTime: "08:00",
    });
    expect(listRoutines()[0].lastDate).toBe("2026-09-28");
  });

  it("does not bring back today's copy after it was deleted", () => {
    createRoutine(pills);
    ensureRoutineCopies("2026-09-28");
    getDb().prepare("DELETE FROM tasks WHERE id = ?").run("r1_2026-09-28");
    ensureRoutineCopies("2026-09-28");
    expect(listTasks()).toHaveLength(0);
  });

  it("files away yesterday's open copy, and keeps a finished one as done", () => {
    createRoutine(pills);
    ensureRoutineCopies("2026-09-27");
    ensureRoutineCopies("2026-09-28");
    updateTask("r1_2026-09-28", {
      completed: true,
      completedAt: "2026-09-28T06:00:00.000Z",
      archivedAt: "2026-09-28T06:00:00.000Z",
    });
    ensureRoutineCopies("2026-09-29");

    const byId = new Map(listTasks().map((t) => [t.id, t]));
    expect(byId.get("r1_2026-09-27")).toMatchObject({ completed: false });
    expect(byId.get("r1_2026-09-27")?.archivedAt).toBeDefined();
    expect(byId.get("r1_2026-09-28")).toMatchObject({ completed: true });
    expect(byId.get("r1_2026-09-29")?.archivedAt).toBeUndefined();
  });

  it("skips days the routine does not fall on, and paused routines", () => {
    createRoutine({ ...pills, repeat: { kind: "weekly", days: [5] } });
    expect(ensureRoutineCopies("2026-09-28")).toHaveLength(0); // Monday
    createRoutine({ ...pills, id: "r2", paused: true });
    expect(ensureRoutineCopies("2026-09-28")).toHaveLength(0);
  });

  it("carries edits over to today's open copy", () => {
    createRoutine({ ...pills, startDate: localToday() });
    ensureRoutineCopies(localToday());
    updateRoutine("r1", { title: "ויטמינים", dueTime: undefined });
    const copy = getTask(`r1_${localToday()}`);
    expect(copy?.title).toBe("ויטמינים");
    expect(copy?.dueTime).toBeUndefined();
  });

  it("deleting a routine keeps its past copies", () => {
    createRoutine(pills);
    ensureRoutineCopies("2026-09-28");
    deleteRoutine("r1");
    expect(listRoutines()).toHaveLength(0);
    expect(getTask("r1_2026-09-28")).not.toBeNull();
  });

  it("survives export and import", () => {
    createRoutine({ ...pills, repeat: { kind: "monthly", day: 10 } });
    const snapshot = readAll();
    clearAll();
    replaceAll(snapshot);
    expect(listRoutines()[0]).toMatchObject({
      id: "r1",
      repeat: { kind: "monthly", day: 10 },
    });
  });
});

describe("subtasks and order", () => {
  it("stores subtasks and clears them with an empty list", () => {
    createTask({
      id: "t1",
      title: "מעבר דירה",
      subtasks: [
        { id: "s1", text: "קרטונים", done: true },
        { id: "s2", text: "הובלה", done: false },
      ],
    });
    expect(getTask("t1")?.subtasks).toHaveLength(2);
    updateTask("t1", { subtasks: [] });
    expect(getTask("t1")?.subtasks).toBeUndefined();
  });

  it("reorders by position", () => {
    createTask({ id: "a", title: "א" });
    createTask({ id: "b", title: "ב" });
    reorderTasks(["b", "a"]);
    expect(getTask("b")?.position).toBe(0);
    expect(getTask("a")?.position).toBe(1);
  });
});

function localToday() {
  return new Date().toLocaleDateString("sv");
}

describe("recurring events", () => {
  it("stores the rule, the end day and per-day changes", () => {
    createEvent({
      id: "e1",
      title: "חוג",
      date: "2026-09-28",
      allDay: false,
      startTime: "17:00",
      color: "sky",
      repeat: { kind: "weekly", days: [1] },
      until: "2026-12-31",
      exceptions: [{ date: "2026-10-05", skip: true }],
    });
    expect(getEvent("e1")).toMatchObject({
      repeat: { kind: "weekly", days: [1] },
      until: "2026-12-31",
      exceptions: [{ date: "2026-10-05", skip: true }],
    });

    updateEvent("e1", { exceptions: [], repeat: undefined, until: undefined });
    const plain = getEvent("e1");
    expect(plain?.repeat).toBeUndefined();
    expect(plain?.until).toBeUndefined();
    expect(plain?.exceptions).toBeUndefined();
  });
});

describe("calendar preferences", () => {
  it("round-trip, and travel with export and import", () => {
    expect(getCalendarPrefs()).toEqual({});
    setCalendarPrefs({ "1": { color: "rose" }, "2": { hidden: true } });
    const snapshot = readAll();
    expect(snapshot.settings.calendars).toEqual({
      "1": { color: "rose" },
      "2": { hidden: true },
    });
    clearAll();
    expect(getCalendarPrefs()).toEqual({});
    replaceAll(snapshot);
    expect(getCalendarPrefs()).toEqual(snapshot.settings.calendars);
  });
});

describe("budgets", () => {
  it("replaces the whole set, drops zeros, and travels with a backup", () => {
    setBudgets({ food: 2000, fun: 0 });
    expect(getBudgets()).toEqual({ food: 2000 });
    setBudgets({ car: 500 });
    expect(getBudgets()).toEqual({ car: 500 });
    const snapshot = readAll();
    clearAll();
    replaceAll(snapshot);
    expect(getBudgets()).toEqual({ car: 500 });
  });
});

describe("bulk transactions", () => {
  it("saves all or nothing, and deletes by ids", () => {
    const row = (id: string) => ({
      id,
      type: "expense" as const,
      amount: 10,
      description: id,
      date: "2026-09-01",
    });
    createTransactions([row("a"), row("b")]);
    expect(listTransactions()).toHaveLength(2);

    // A duplicate id fails the whole batch; "c" must not stay behind.
    expect(() => createTransactions([row("c"), row("a")])).toThrow();
    expect(
      listTransactions()
        .map((t) => t.id)
        .sort(),
    ).toEqual(["a", "b"]);

    deleteTransactions(["a", "b"]);
    expect(listTransactions()).toHaveLength(0);
  });
});

describe("links", () => {
  it("links two items once, either way round, and unlinks", () => {
    const first = createLink({
      aKind: "task",
      aId: "t",
      bKind: "event",
      bId: "e",
    });
    const again = createLink({
      aKind: "event",
      aId: "e",
      bKind: "task",
      bId: "t",
    });
    expect(again.id).toBe(first.id);
    expect(listLinks()).toHaveLength(1);

    const snapshot = readAll();
    clearAll();
    replaceAll(snapshot);
    expect(listLinks()).toEqual(snapshot.links);

    deleteLink(first.id);
    expect(listLinks()).toEqual([]);
  });
});
