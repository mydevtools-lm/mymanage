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
  getPrefs,
  setPrefs,
  addSampleData,
  removeSampleData,
} from "./repo";

beforeEach(async () => {
  process.env.LIOR_DB_PATH = ":memory:";
  resetDbForTests();
});

describe("schema", () => {
  it("runs every migration on a fresh database", async () => {
    const { user_version } = getDb().prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(user_version).toBe(SCHEMA_VERSION);
  });

  it("seeds the default categories once", async () => {
    expect(await listCategories()).toHaveLength(12);
    resetDbForTests();
    expect(await listCategories()).toHaveLength(12);
  });
});

describe("tasks", () => {
  it("keeps an id chosen by the client", async () => {
    await createTask({ id: "client-id", title: "משימה" });
    expect((await getTask("client-id"))?.title).toBe("משימה");
  });

  // Clearing a field arrives as null (see json-body.ts). Before that fix the
  // key was dropped in transit, so restoring from the archive left the task
  // archived after a reload.
  it("clears fields that arrive as null", async () => {
    const home = (await listCategories()).find((c) => c.kind === "task")!;
    await createTask({
      id: "t",
      title: "x",
      dueDate: "2026-09-28",
      categoryId: home.id,
      archivedAt: "2026-09-28T10:00:00.000Z",
    });
    const cleared = await updateTask("t", {
      dueDate: null,
      categoryId: null,
      archivedAt: null,
    } as never);
    expect(cleared?.dueDate).toBeUndefined();
    expect(cleared?.categoryId).toBeUndefined();
    expect(cleared?.archivedAt).toBeUndefined();
  });

  it("leaves fields that are absent from the patch untouched", async () => {
    await createTask({ id: "t", title: "x", dueDate: "2026-09-28" });
    expect((await updateTask("t", { title: "y" }))?.dueDate).toBe("2026-09-28");
  });
});

describe("transactions", () => {
  it("round-trips per-month exceptions", async () => {
    await createTransaction({
      id: "rent",
      type: "expense",
      amount: 4500,
      description: "שכר דירה",
      date: "2026-09-01",
      recurring: { startMonth: "2026-09" },
    });
    await updateTransaction("rent", {
      exceptions: [{ month: "2026-10", skip: true }],
    });
    expect((await getTransaction("rent"))?.exceptions).toEqual([
      { month: "2026-10", skip: true },
    ]);
  });

  it("stops recurring when recurring arrives as null", async () => {
    await createTransaction({
      id: "r",
      amount: 1,
      description: "x",
      date: "2026-09-01",
      recurring: { startMonth: "2026-09" },
    });
    await updateTransaction("r", { recurring: null } as never);
    expect((await getTransaction("r"))?.recurring).toBeUndefined();
  });
});

describe("checklists", () => {
  it("keeps client ids for the list and its items", async () => {
    await createChecklist("קניות", [{ id: "i1", text: "שמן בישול" }], "list-1");
    await addChecklistItem("list-1", "אקונומיקה", "i2");
    const [list] = await listChecklists();
    expect(list.id).toBe("list-1");
    expect(list.items.map((i) => [i.id, i.text])).toEqual([
      ["i1", "שמן בישול"],
      ["i2", "אקונומיקה"],
    ]);
  });
});

describe("checklist undo", () => {
  it("re-inserts an item at a given index and keeps the order dense", async () => {
    await createChecklist("קניות", ["שמן", "לחם"], "l");
    await addChecklistItem("l", "חלב", "milk", { index: 1, done: true });
    const [list] = await listChecklists();
    expect(list.items.map((i) => [i.text, i.done])).toEqual([
      ["שמן", false],
      ["חלב", true],
      ["לחם", false],
    ]);
    // A later append still lands at the end.
    await addChecklistItem("l", "ביצים");
    expect((await listChecklists())[0].items.at(-1)?.text).toBe("ביצים");
  });
});

describe("lists and notes (מ7)", () => {
  it("resets a list: every item unticked, nothing removed", async () => {
    await createChecklist("קניות", ["שמן", "חלב"], "l");
    const [first] = (await listChecklists())[0].items;
    await addChecklistItem("l", "לחם", "bread", { done: true });
    await resetChecklist("l");
    const items = (await listChecklists())[0].items;
    expect(items).toHaveLength(3);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(items[0].id).toBe(first.id);
  });

  it("stores a new item order and keeps unknown ids out", async () => {
    await createChecklist(
      "x",
      [
        { id: "a", text: "a" },
        { id: "b", text: "b" },
        { id: "c", text: "c" },
      ],
      "l",
    );
    await reorderChecklistItems("l", ["c", "a", "nope"]);
    expect((await listChecklists())[0].items.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("lists pinned lists first, then newest — not by last tick", async () => {
    await createChecklist("old", [], "old");
    await createChecklist("new", [{ id: "n1", text: "x" }], "new");
    // Ticking an item in the old list must not move it above the new one.
    await addChecklistItem("old", "y");
    expect((await listChecklists()).map((l) => l.id)).toEqual(["new", "old"]);
    await setChecklistPinned("old", true);
    expect((await listChecklists()).map((l) => l.id)).toEqual(["old", "new"]);
  });

  it("pins and colours a note without touching its updated date", async () => {
    await createNote({
      id: "n",
      title: "t",
      body: "b",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await updateNote("n", { pinned: true, color: "amber" } as never);
    const note = (await getNote("n"))!;
    expect(note.pinned).toBe(true);
    expect(note.color).toBe("amber");
    expect(note.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    await updateNote("n", { body: "changed" });
    expect((await getNote("n"))!.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("lists pinned notes first", async () => {
    await createNote({ id: "a", title: "a", body: "" });
    await createNote({ id: "b", title: "b", body: "" });
    await updateNote("a", { pinned: true } as never);
    expect((await listNotes())[0].id).toBe("a");
  });
});

describe("categories", () => {
  it("unlinks items instead of deleting them", async () => {
    const c = await createCategory({
      id: "c1",
      name: "זמני",
      color: "teal",
      kind: "task",
    });
    await createTask({ id: "t", title: "x", categoryId: c.id });
    await deleteCategory(c.id);
    expect((await getTask("t"))?.categoryId).toBeUndefined();
  });
});

describe("backup round trip", () => {
  it("export → wipe → import restores the same data", async () => {
    await createTask({ id: "t1", title: "להחליף סיסמה", priority: "high" });
    await createChecklist("קניות", ["שמן בישול", "אקונומיקה"], "l1");
    await createTransaction({
      id: "x1",
      amount: 12000,
      type: "income",
      description: "משכורת",
      date: "2026-09-10",
      recurring: { startMonth: "2026-09" },
      exceptions: [{ month: "2026-12", amount: 15000 }],
    });

    const exported = JSON.parse(JSON.stringify(await readAll()));
    const wiped = await clearAll();
    expect(wiped.tasks).toHaveLength(0);
    expect(wiped.categories).toHaveLength(12); // re-seeded

    const restored = await replaceAll(exported);
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

  beforeEach(async () => {
    dir = await mkdtempSync(path.join(tmpdir(), "lior-db-"));
    process.env.LIOR_DB_PATH = path.join(dir, "lior.db");
    resetDbForTests();
  });

  afterEach(async () => {
    resetDbForTests();
    await rmSync(dir, { recursive: true, force: true });
  });

  it("writes one snapshot per day next to the database", async () => {
    getDb();
    const backups = path.join(dir, "backups");
    expect(await readdirSync(backups)).toHaveLength(1);
    getDb();
    expect(await readdirSync(backups)).toHaveLength(1);
  });

  it("keeps only the 14 most recent snapshots", async () => {
    const db = getDb();
    const backups = path.join(dir, "backups");
    for (let day = 1; day <= 20; day++) {
      await writeFileSync(
        path.join(backups, `lior-2026-08-${String(day).padStart(2, "0")}.db`),
        "",
      );
    }
    // Later than any real day, so the snapshot getDb() just took of today sorts
    // before it no matter when the test runs.
    backupIfDue(db, "2099-01-01");
    const kept = (await readdirSync(backups)).sort();
    expect(kept).toHaveLength(14);
    expect(kept.at(-1)).toBe("lior-2099-01-01.db");
    expect(await existsSync(path.join(backups, "lior-2026-08-01.db"))).toBe(false);
  });

  it("skips in-memory databases", async () => {
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

  it("makes one copy for today, however often it is asked", async () => {
    await createRoutine(pills);
    expect(await ensureRoutineCopies("2026-09-28")).toHaveLength(1);
    expect(await ensureRoutineCopies("2026-09-28")).toHaveLength(0);

    const copies = (await listTasks()).filter((t) => t.routineId === "r1");
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      id: "r1_2026-09-28",
      title: "כדורים",
      dueDate: "2026-09-28",
      dueTime: "08:00",
    });
    expect((await listRoutines())[0].lastDate).toBe("2026-09-28");
  });

  it("does not bring back today's copy after it was deleted", async () => {
    await createRoutine(pills);
    await ensureRoutineCopies("2026-09-28");
    getDb().prepare("DELETE FROM tasks WHERE id = ?").run("r1_2026-09-28");
    await ensureRoutineCopies("2026-09-28");
    expect(await listTasks()).toHaveLength(0);
  });

  it("files away yesterday's open copy, and keeps a finished one as done", async () => {
    await createRoutine(pills);
    await ensureRoutineCopies("2026-09-27");
    await ensureRoutineCopies("2026-09-28");
    await updateTask("r1_2026-09-28", {
      completed: true,
      completedAt: "2026-09-28T06:00:00.000Z",
      archivedAt: "2026-09-28T06:00:00.000Z",
    });
    await ensureRoutineCopies("2026-09-29");

    const byId = new Map((await listTasks()).map((t) => [t.id, t]));
    expect(byId.get("r1_2026-09-27")).toMatchObject({ completed: false });
    expect(byId.get("r1_2026-09-27")?.archivedAt).toBeDefined();
    expect(byId.get("r1_2026-09-28")).toMatchObject({ completed: true });
    expect(byId.get("r1_2026-09-29")?.archivedAt).toBeUndefined();
  });

  it("skips days the routine does not fall on, and paused routines", async () => {
    await createRoutine({ ...pills, repeat: { kind: "weekly", days: [5] } });
    expect(await ensureRoutineCopies("2026-09-28")).toHaveLength(0); // Monday
    await createRoutine({ ...pills, id: "r2", paused: true });
    expect(await ensureRoutineCopies("2026-09-28")).toHaveLength(0);
  });

  it("carries edits over to today's open copy", async () => {
    await createRoutine({ ...pills, startDate: localToday() });
    await ensureRoutineCopies(localToday());
    await updateRoutine("r1", { title: "ויטמינים", dueTime: undefined });
    const copy = await getTask(`r1_${localToday()}`);
    expect(copy?.title).toBe("ויטמינים");
    expect(copy?.dueTime).toBeUndefined();
  });

  it("deleting a routine keeps its past copies", async () => {
    await createRoutine(pills);
    await ensureRoutineCopies("2026-09-28");
    await deleteRoutine("r1");
    expect(await listRoutines()).toHaveLength(0);
    expect(await getTask("r1_2026-09-28")).not.toBeNull();
  });

  it("survives export and import", async () => {
    await createRoutine({ ...pills, repeat: { kind: "monthly", day: 10 } });
    const snapshot = await readAll();
    await clearAll();
    await replaceAll(snapshot);
    expect((await listRoutines())[0]).toMatchObject({
      id: "r1",
      repeat: { kind: "monthly", day: 10 },
    });
  });
});

describe("subtasks and order", () => {
  it("stores subtasks and clears them with an empty list", async () => {
    await createTask({
      id: "t1",
      title: "מעבר דירה",
      subtasks: [
        { id: "s1", text: "קרטונים", done: true },
        { id: "s2", text: "הובלה", done: false },
      ],
    });
    expect((await getTask("t1"))?.subtasks).toHaveLength(2);
    await updateTask("t1", { subtasks: [] });
    expect((await getTask("t1"))?.subtasks).toBeUndefined();
  });

  it("reorders by position", async () => {
    await createTask({ id: "a", title: "א" });
    await createTask({ id: "b", title: "ב" });
    await reorderTasks(["b", "a"]);
    expect((await getTask("b"))?.position).toBe(0);
    expect((await getTask("a"))?.position).toBe(1);
  });
});

function localToday() {
  return new Date().toLocaleDateString("sv");
}

describe("recurring events", () => {
  it("stores the rule, the end day and per-day changes", async () => {
    await createEvent({
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
    expect(await getEvent("e1")).toMatchObject({
      repeat: { kind: "weekly", days: [1] },
      until: "2026-12-31",
      exceptions: [{ date: "2026-10-05", skip: true }],
    });

    await updateEvent("e1", { exceptions: [], repeat: undefined, until: undefined });
    const plain = await getEvent("e1");
    expect(plain?.repeat).toBeUndefined();
    expect(plain?.until).toBeUndefined();
    expect(plain?.exceptions).toBeUndefined();
  });
});

describe("calendar preferences", () => {
  it("round-trip, and travel with export and import", async () => {
    expect(await getCalendarPrefs()).toEqual({});
    await setCalendarPrefs({ "1": { color: "rose" }, "2": { hidden: true } });
    const snapshot = await readAll();
    expect(snapshot.settings.calendars).toEqual({
      "1": { color: "rose" },
      "2": { hidden: true },
    });
    await clearAll();
    expect(await getCalendarPrefs()).toEqual({});
    await replaceAll(snapshot);
    expect(await getCalendarPrefs()).toEqual(snapshot.settings.calendars);
  });
});

describe("budgets", () => {
  it("replaces the whole set, drops zeros, and travels with a backup", async () => {
    await setBudgets({ food: 2000, fun: 0 });
    expect(await getBudgets()).toEqual({ food: 2000 });
    await setBudgets({ car: 500 });
    expect(await getBudgets()).toEqual({ car: 500 });
    const snapshot = await readAll();
    await clearAll();
    await replaceAll(snapshot);
    expect(await getBudgets()).toEqual({ car: 500 });
  });
});

describe("bulk transactions", () => {
  it("saves all or nothing, and deletes by ids", async () => {
    const row = (id: string) => ({
      id,
      type: "expense" as const,
      amount: 10,
      description: id,
      date: "2026-09-01",
    });
    await createTransactions([row("a"), row("b")]);
    expect(await listTransactions()).toHaveLength(2);

    // A duplicate id fails the whole batch; "c" must not stay behind.
    await expect(createTransactions([row("c"), row("a")])).rejects.toThrow();
    expect(
      (await listTransactions()).map((t) => t.id).sort(),
    ).toEqual(["a", "b"]);

    await deleteTransactions(["a", "b"]);
    expect(await listTransactions()).toHaveLength(0);
  });
});

describe("links", () => {
  it("links two items once, either way round, and unlinks", async () => {
    const first = await createLink({
      aKind: "task",
      aId: "t",
      bKind: "event",
      bId: "e",
    });
    const again = await createLink({
      aKind: "event",
      aId: "e",
      bKind: "task",
      bId: "t",
    });
    expect(again.id).toBe(first.id);
    expect(await listLinks()).toHaveLength(1);

    const snapshot = await readAll();
    await clearAll();
    await replaceAll(snapshot);
    expect(await listLinks()).toEqual(snapshot.links);

    await deleteLink(first.id);
    expect(await listLinks()).toEqual([]);
  });
});

describe("preferences", () => {
  it("merge in, clear with null, and travel with a backup", async () => {
    expect(await getPrefs()).toEqual({});
    await setPrefs({ weekStart: 1, currency: "USD" });
    await setPrefs({ defaultReminder: 10 });
    expect(await getPrefs()).toEqual({
      weekStart: 1,
      currency: "USD",
      defaultReminder: 10,
    });
    await setPrefs({ defaultReminder: null });
    expect(await getPrefs()).toEqual({ weekStart: 1, currency: "USD" });

    const snapshot = await readAll();
    await clearAll();
    expect(await getPrefs()).toEqual({});
    await replaceAll(snapshot);
    expect(await getPrefs()).toEqual({ weekStart: 1, currency: "USD" });
  });
});

describe("sample data", () => {
  it("adds a set the person can take away again, leaving their own rows", async () => {
    const mine = await createTask({ title: "שלי" });
    const added = await addSampleData("2026-10-13");
    expect(added.tasks.length).toBe(4);
    expect(added.events.map((e) => e.date)).toEqual(["2026-10-13", "2026-10-14"]);
    // Linked to the default categories by name.
    expect(added.transactions.every((t) => t.categoryId)).toBe(true);

    const sampleTask = added.tasks.find((t) => t.id.startsWith("sample-"))!;
    await createLink({ aKind: "task", aId: sampleTask.id, bKind: "task", bId: mine.id });

    const after = await removeSampleData();
    expect(after.tasks.map((t) => t.id)).toEqual([mine.id]);
    expect(after.events).toEqual([]);
    expect(after.transactions).toEqual([]);
    expect(after.notes).toEqual([]);
    expect(after.links).toEqual([]);
  });
});
