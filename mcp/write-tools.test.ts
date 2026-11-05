import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { seedDefaults } from "../src/lib/db";
import { localDateKey } from "../src/lib/keys";
import { BASE_SCHEMA, MIGRATIONS } from "../src/lib/schema";
import { buildMcp } from "../scripts/build-mcp.mjs";
import { openReadOnly } from "./readonly-db";
import { createServer } from "./tools";
import { openWritable, type WritableDb } from "./writable-db";

/**
 * The tools that change data (ד11), through a real MCP client against a real
 * database file, the way a chat uses them.
 */

const TODAY = localDateKey();

let dir: string;
let counter = 0;
const opened: { close(): void }[] = [];

/** A fresh database file, the shape the app leaves it in. */
function newDatabase() {
  const folder = path.join(dir, `data-${++counter}`);
  mkdirSync(folder);
  const file = path.join(folder, "data.db");
  const database = new DatabaseSync(file);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec(BASE_SCHEMA);
  MIGRATIONS.forEach((sql, version) => {
    database.exec(sql);
    database.exec(`PRAGMA user_version = ${version + 1}`);
  });
  seedDefaults(database);
  database.close();
  return file;
}

async function clientOn(database: WritableDb, write = true) {
  const server = createServer(database, { write });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

/** Lets a test read the file through a second connection, like the app. */
function peek<T>(file: string, sql: string, ...params: (string | number)[]) {
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    return database.prepare(sql).all(...params) as T[];
  } finally {
    database.close();
  }
}

let file: string;
let client: Client;

async function call(name: string, args: Record<string, unknown> = {}) {
  const response = await client.callTool({ name, arguments: args });
  const [first] = response.content as { type: string; text: string }[];
  return {
    isError: !!response.isError,
    text: first.text,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: (response.isError ? null : JSON.parse(first.text)) as any,
  };
}

/** A call that has to work: its answer, or the test fails with the reason. */
async function ok(name: string, args: Record<string, unknown> = {}) {
  const answer = await call(name, args);
  if (answer.isError) throw new Error(`${name}: ${answer.text}`);
  return answer.json;
}

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mymanage-mcp-write-"));
});

beforeEach(async () => {
  file = newDatabase();
  const database = await openWritable(file);
  opened.push(database);
  client = await clientOn(database);
});

afterAll(() => {
  for (const database of opened) database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("--write is a choice", () => {
  it("without it there is nothing that changes data", async () => {
    const database = await openReadOnly(file);
    opened.push(database);
    const reading = await clientOn(database as unknown as WritableDb, false);
    const names = (await reading.listTools()).tools.map((t) => t.name);
    expect(names).toContain("list_tasks");
    expect(names).toContain("list_routines");
    expect(names.filter((n) => /^(create|update|delete|add|set|link|unlink)_/.test(n))).toEqual([]);
  });

  it("with it, every kind of data can be added and changed", async () => {
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const kind of ["task", "routine", "event", "note", "checklist", "category"]) {
      expect(names).toContain(`create_${kind}`);
      expect(names).toContain(`update_${kind}`);
      expect(names).toContain(`delete_${kind}`);
    }
    expect(names).toContain("create_transactions");
    expect(names).toContain("update_transaction");
    expect(names).toContain("delete_transaction");
    for (const name of ["add_checklist_items", "set_budget", "update_preferences", "link_items"]) {
      expect(names).toContain(name);
    }
  });

  it("marks what deletes so a client can ask first", async () => {
    const { tools } = await client.listTools();
    const hint = (name: string) =>
      tools.find((t) => t.name === name)?.annotations?.destructiveHint;
    expect(hint("delete_task")).toBe(true);
    expect(hint("create_task")).toBe(false);
  });

  it("offers no way to wipe or replace everything", async () => {
    const names = (await client.listTools()).tools.map((t) => t.name).join(" ");
    expect(names).not.toMatch(/clear|wipe|replace|import|secret|sync/);
  });
});

describe("tasks", () => {
  it("adds a task, with a category by name, and it is in the file", async () => {
    const task = await ok("create_task", {
      title: "לקנות חלב",
      dueDate: TODAY,
      dueTime: "09:30",
      priority: "high",
      category: "עבודה",
      subtasks: ["לבדוק מחיר"],
    });
    expect(task.title).toBe("לקנות חלב");
    expect(task.category).toBe("עבודה");
    expect(task.subtasks[0].text).toBe("לבדוק מחיר");
    const rows = peek<{ title: string; dueTime: string }>(
      file,
      "SELECT title, dueTime FROM tasks WHERE id = ?",
      task.id,
    );
    expect(rows).toEqual([{ title: "לקנות חלב", dueTime: "09:30" }]);
  });

  it("a task with a time gets the default reminder, one without doesn't", async () => {
    await ok("update_preferences", { defaultReminder: 15 });
    const timed = await ok("create_task", {
      title: "a",
      dueDate: TODAY,
      dueTime: "10:00",
    });
    expect(timed.reminder).toBe(15);
    const plain = await ok("create_task", { title: "b", dueDate: TODAY });
    expect(plain.reminder).toBeUndefined();
    const asked = await ok("create_task", {
      title: "c",
      dueDate: TODAY,
      dueTime: "10:00",
      reminder: 60,
    });
    expect(asked.reminder).toBe(60);
  });

  it("completing files it away as the app does, and reopening undoes it", async () => {
    const { id } = await ok("create_task", { title: "a" });
    const done = await ok("update_task", { id, completed: true });
    expect(done.completed).toBe(true);
    expect(done.archived).toBe(true);
    expect(done.completedAt).toBeTruthy();
    const back = await ok("update_task", { id, completed: false });
    expect(back).toMatchObject({ completed: false, archived: false });
    expect(back.completedAt).toBeUndefined();
  });

  it("sends only what changes, and null clears", async () => {
    const { id } = await ok("create_task", {
      title: "a",
      description: "b",
      dueDate: TODAY,
      dueTime: "10:00",
      category: "עבודה",
    });
    const renamed = await ok("update_task", { id, title: "c" });
    expect(renamed).toMatchObject({ title: "c", description: "b", category: "עבודה" });
    const cleared = await ok("update_task", { id, description: null, category: null });
    expect(cleared.description).toBeUndefined();
    expect(cleared.category).toBeNull();
    // A time means nothing without its day.
    const undated = await ok("update_task", { id, dueDate: null });
    expect(undated.dueDate).toBeUndefined();
    expect(undated.dueTime).toBeUndefined();
  });

  it("refuses what makes no sense and changes nothing", async () => {
    const count = () =>
      peek<{ n: number }>(file, "SELECT COUNT(*) AS n FROM tasks")[0].n;
    const before = count();
    expect((await call("create_task", { title: "" })).isError).toBe(true);
    expect((await call("create_task", { title: "a", dueDate: "2026-02-31" })).isError).toBe(true);
    expect((await call("create_task", { title: "a", dueDate: TODAY, dueTime: "25:00" })).isError).toBe(true);
    expect((await call("create_task", { title: "a", priority: "huge" })).isError).toBe(true);
    const noDay = await call("create_task", { title: "a", dueTime: "10:00" });
    expect(noDay.text).toMatch(/needs a dueDate/);
    const wrong = await call("create_task", { title: "a", category: "Nope" });
    expect(wrong.text).toMatch(/No task category "Nope"\. There are: .*עבודה/);
    expect(count()).toBe(before);
  });

  it("a category of the other kind doesn't count", async () => {
    const answer = await call("create_task", { title: "a", category: "אוכל" });
    expect(answer.isError).toBe(true);
  });

  it("deletes, and says so when there is no such task", async () => {
    const { id } = await ok("create_task", { title: "a" });
    expect((await ok("delete_task", { id })).deleted.title).toBe("a");
    const again = await call("delete_task", { id });
    expect(again.isError).toBe(true);
    expect(again.text).toMatch(/No task with id/);
    const update = await call("update_task", { id: "nope", title: "b" });
    expect(update.text).toMatch(/No task with id nope/);
  });
});

describe("routines", () => {
  it("a new routine makes today's task, as the app does", async () => {
    const routine = await ok("create_routine", {
      title: "כדורים",
      repeat: { kind: "daily" },
      category: "אישי",
    });
    expect(routine.startDate).toBe(TODAY);
    const { tasks } = await ok("today");
    expect(tasks.map((t: { title: string }) => t.title)).toContain("כדורים");
    const { routines } = await ok("list_routines");
    expect(routines[0]).toMatchObject({ title: "כדורים", category: "אישי" });
  });

  it("a change reaches today's open task, and pausing keeps the routine", async () => {
    const { id } = await ok("create_routine", {
      title: "a",
      repeat: { kind: "daily" },
    });
    await ok("update_routine", { id, title: "b" });
    const { tasks } = await ok("today");
    expect(tasks[0].title).toBe("b");
    expect((await ok("update_routine", { id, paused: true })).paused).toBe(true);
    await ok("delete_routine", { id });
    expect((await ok("list_routines")).total).toBe(0);
    // What it already made stays, as history.
    expect((await ok("today")).tasks).toHaveLength(1);
  });

  it("checks the repeat rule", async () => {
    const bad = await call("create_routine", {
      title: "a",
      repeat: { kind: "weekly", days: [9] },
    });
    expect(bad.isError).toBe(true);
  });
});

describe("events", () => {
  const YOGA = {
    title: "יוגה",
    date: "2026-11-01",
    startTime: "18:30",
    repeat: { kind: "weekly", days: [0] },
  };
  const inNovember = async () =>
    (await ok("list_events", { from: "2026-11-01", to: "2026-11-30" })).events;

  it("adds an event; without a time it is all day", async () => {
    const timed = await ok("create_event", {
      title: "צהריים",
      date: "2026-11-10",
      startTime: "13:00",
      endTime: "14:00",
      location: "תל אביב",
    });
    expect(timed).toMatchObject({ allDay: false, location: "תל אביב" });
    const allDay = await ok("create_event", { title: "חג", date: "2026-11-11" });
    expect(allDay.allDay).toBe(true);
    const noStart = await call("create_event", {
      title: "a",
      date: "2026-11-11",
      endTime: "14:00",
    });
    expect(noStart.isError).toBe(true);
  });

  it("moves a one-off event and needs no scope", async () => {
    const { id } = await ok("create_event", {
      title: "a",
      date: "2026-11-10",
      startTime: "13:00",
    });
    const { updated } = await ok("update_event", { id, date: "2026-11-12" });
    expect(updated.date).toBe("2026-11-12");
    const whole = await ok("update_event", { id, allDay: true });
    expect(whole.updated).toMatchObject({ allDay: true });
    expect(whole.updated.startTime).toBeUndefined();
  });

  it("a repeating event won't change until told how far", async () => {
    const { id } = await ok("create_event", YOGA);
    const noScope = await call("update_event", { id, title: "b" });
    expect(noScope.isError).toBe(true);
    expect(noScope.text).toMatch(/Pass scope/);
    const noDay = await call("update_event", { id, title: "b", scope: "this" });
    expect(noDay.text).toMatch(/needs occurrenceDate/);
    const wrongDay = await call("update_event", {
      id,
      title: "b",
      scope: "this",
      occurrenceDate: "2026-11-03",
    });
    expect(wrongDay.text).toMatch(/no occurrence on 2026-11-03/);
    expect((await inNovember()).every((e: { title: string }) => e.title === "יוגה")).toBe(true);
  });

  it("changes one occurrence, using what list_events shows", async () => {
    const { id } = await ok("create_event", YOGA);
    const [, second] = await inNovember();
    expect(second.occurrenceDate).toBe("2026-11-08");
    await ok("update_event", {
      id: second.id,
      scope: "this",
      occurrenceDate: second.occurrenceDate,
      startTime: "19:00",
    });
    const events = await inNovember();
    expect(events.map((e: { startTime: string }) => e.startTime)).toEqual([
      "18:30",
      "19:00",
      "18:30",
      "18:30",
      "18:30",
    ]);
    expect(events[0].id).toBe(id);
  });

  it("from here on splits the series", async () => {
    const { id } = await ok("create_event", YOGA);
    const answer = await ok("update_event", {
      id,
      scope: "following",
      occurrenceDate: "2026-11-15",
      title: "פילאטיס",
    });
    expect(answer.updated.until).toBe("2026-11-14");
    expect(answer.startedAsNewSeries.date).toBe("2026-11-15");
    expect((await inNovember()).map((e: { title: string }) => e.title)).toEqual([
      "יוגה",
      "יוגה",
      "פילאטיס",
      "פילאטיס",
      "פילאטיס",
    ]);
  });

  it("deletes one occurrence, the rest from a day on, or all", async () => {
    const { id } = await ok("create_event", YOGA);
    await ok("delete_event", { id, scope: "this", occurrenceDate: "2026-11-08" });
    expect(await inNovember()).toHaveLength(4);
    await ok("delete_event", { id, scope: "following", occurrenceDate: "2026-11-22" });
    expect((await inNovember()).map((e: { date: string }) => e.date)).toEqual([
      "2026-11-01",
      "2026-11-15",
    ]);
    await ok("delete_event", { id, scope: "all" });
    expect(await inNovember()).toHaveLength(0);
  });
});

describe("transactions", () => {
  const summary = (month: string) => ok("finance_summary", { month });

  it("adds several together, with categories by name", async () => {
    const { created } = await ok("create_transactions", {
      transactions: [
        { type: "expense", amount: 240, description: "סופר", date: "2026-11-02", category: "אוכל" },
        { type: "income", amount: 12000, description: "משכורת", date: "2026-11-01", category: "משכורת" },
      ],
    });
    expect(created).toHaveLength(2);
    expect(created[0].category).toBe("אוכל");
    expect(await summary("2026-11")).toMatchObject({ income: 12000, expense: 240 });
  });

  it("all of them or none", async () => {
    const answer = await call("create_transactions", {
      transactions: [
        { type: "expense", amount: 1, description: "a", date: "2026-11-02" },
        { type: "expense", amount: 2, description: "b", date: "2026-11-02", category: "Nope" },
      ],
    });
    expect(answer.isError).toBe(true);
    expect(peek(file, "SELECT id FROM transactions")).toEqual([]);
    const negative = await call("create_transactions", {
      transactions: [{ type: "expense", amount: -5, description: "a", date: "2026-11-02" }],
    });
    expect(negative.isError).toBe(true);
  });

  const rent = async () =>
    (
      await ok("create_transactions", {
        transactions: [
          {
            type: "expense",
            amount: 3000,
            description: "שכירות",
            date: "2026-09-02",
            recurring: {},
          },
        ],
      })
    ).created[0];

  it("a monthly one fills the months, and starts from its date", async () => {
    const { id, recurring } = await rent();
    expect(recurring).toEqual({ startMonth: "2026-09" });
    expect((await summary("2026-12")).expense).toBe(3000);
    expect((await summary("2026-08")).expense).toBe(0);
    const noScope = await call("update_transaction", { id, amount: 1 });
    expect(noScope.text).toMatch(/Pass scope/);
  });

  it("changes one month, or from a month on, or all", async () => {
    const { id } = await rent();
    await ok("update_transaction", { id, scope: "this", month: "2026-10", amount: 3100 });
    expect((await summary("2026-10")).expense).toBe(3100);
    expect((await summary("2026-11")).expense).toBe(3000);

    const split = await ok("update_transaction", {
      id,
      scope: "following",
      month: "2026-12",
      amount: 3500,
    });
    expect(split.startedAsNewSeries.recurring.startMonth).toBe("2026-12");
    expect((await summary("2026-11")).expense).toBe(3000);
    expect((await summary("2027-01")).expense).toBe(3500);

    await ok("update_transaction", { id, scope: "all", description: "דירה" });
    const { transactions } = await ok("list_transactions", { month: "2026-11" });
    expect(transactions[0].description).toBe("דירה");
  });

  it("one month can't take what only the series has", async () => {
    const { id } = await rent();
    for (const change of [{ date: "2026-10-05" }, { recurring: null }, { type: "income" }, { category: null }]) {
      const answer = await call("update_transaction", {
        id,
        scope: "this",
        month: "2026-10",
        ...change,
      });
      expect(answer.isError).toBe(true);
    }
    const outside = await call("update_transaction", {
      id,
      scope: "this",
      month: "2026-01",
      amount: 1,
    });
    expect(outside.text).toMatch(/doesn't include 2026-01/);
  });

  it("a one-off can become monthly, and back", async () => {
    const { created } = await ok("create_transactions", {
      transactions: [{ type: "expense", amount: 50, description: "a", date: "2026-11-05" }],
    });
    const { id } = created[0];
    const monthly = await ok("update_transaction", { id, recurring: {} });
    expect(monthly.updated.recurring.startMonth).toBe("2026-11");
    const once = await ok("update_transaction", { id, scope: "all", recurring: null });
    expect(once.updated.recurring).toBeNull();
  });

  it("deletes a month, stops from a month, or removes it", async () => {
    const { id } = await rent();
    await ok("delete_transaction", { id, scope: "this", month: "2026-10" });
    expect((await summary("2026-10")).expense).toBe(0);
    await ok("delete_transaction", { id, scope: "following", month: "2026-12" });
    expect((await summary("2026-11")).expense).toBe(3000);
    expect((await summary("2026-12")).expense).toBe(0);
    await ok("delete_transaction", { id, scope: "all" });
    expect(peek(file, "SELECT id FROM transactions")).toEqual([]);
  });
});

describe("notes and lists", () => {
  it("notes: add, change, pin keeps the date, delete", async () => {
    const empty = await call("create_note", {});
    expect(empty.isError).toBe(true);
    const note = await ok("create_note", { title: "מתנות", body: "ספר" });
    const pinned = await ok("update_note", { id: note.id, pinned: true });
    expect(pinned.updatedAt).toBe(note.updatedAt);
    const edited = await ok("update_note", { id: note.id, body: "ספר ועציץ" });
    expect((await ok("get_note", { id: note.id })).body).toBe("ספר ועציץ");
    expect(edited.pinned).toBe(true);
    await ok("delete_note", { id: note.id });
    expect((await ok("list_notes")).total).toBe(0);
  });

  it("lists: add, tick, reword, tidy, delete", async () => {
    const list = await ok("create_checklist", {
      title: "קניות",
      items: ["חלב", "לחם"],
    });
    const [milk, bread] = list.items;
    const more = await ok("add_checklist_items", {
      listId: list.id,
      items: ["ביצים"],
    });
    expect(more.items.map((i: { text: string }) => i.text)).toEqual(["חלב", "לחם", "ביצים"]);

    await ok("update_checklist_item", { listId: list.id, itemId: milk.id, done: true });
    const reworded = await ok("update_checklist_item", {
      listId: list.id,
      itemId: bread.id,
      text: "לחם מלא",
    });
    expect(reworded.items[0].done).toBe(true);
    expect(reworded.items[1].text).toBe("לחם מלא");

    const fresh = await ok("update_checklist", { id: list.id, uncheckAll: true, pinned: true, title: "סופר" });
    expect(fresh).toMatchObject({ title: "סופר", pinned: true });
    expect(fresh.items.every((i: { done: boolean }) => !i.done)).toBe(true);

    const order = [bread.id, milk.id];
    const sorted = await ok("update_checklist", { id: list.id, order });
    expect(sorted.items[0].id).toBe(bread.id);

    await ok("update_checklist_item", { listId: list.id, itemId: milk.id, done: true });
    const tidied = await ok("update_checklist", { id: list.id, clearDone: true });
    expect(tidied.items).toHaveLength(2);

    const gone = await ok("delete_checklist_item", { listId: list.id, itemId: bread.id });
    expect(gone.items).toHaveLength(1);
    const ghost = await call("update_checklist_item", {
      listId: list.id,
      itemId: "nope",
      done: true,
    });
    expect(ghost.isError).toBe(true);

    await ok("delete_checklist", { id: list.id });
    // Foreign keys are on: the items go with the list.
    expect(peek(file, "SELECT id FROM checklist_items")).toEqual([]);
  });
});

describe("categories, budgets, preferences, links", () => {
  it("deleting a category keeps what was in it", async () => {
    const category = await ok("create_category", { name: "כלב", kind: "task", color: "amber" });
    const duplicate = await call("create_category", { name: "כלב", kind: "task" });
    expect(duplicate.isError).toBe(true);
    const task = await ok("create_task", { title: "וטרינר", category: "כלב" });
    expect(task.category).toBe("כלב");
    // A name counts whatever its case.
    await ok("create_category", { name: "Dog", kind: "task" });
    const cased = await ok("create_task", { title: "a", category: "dog" });
    expect(cased.category).toBe("Dog");
    await ok("delete_task", { id: cased.id });
    await ok("update_category", { id: category.id, name: "הכלב" });
    expect((await ok("list_tasks")).tasks[0].category).toBe("הכלב");
    await ok("delete_category", { id: category.id });
    expect((await ok("list_tasks")).tasks[0].category).toBeNull();
  });

  it("a budget changes one category and leaves the others", async () => {
    await ok("set_budget", { category: "אוכל", amount: 2000 });
    const both = await ok("set_budget", { category: "חשבונות", amount: 500 });
    expect(both).toHaveLength(2);
    await ok("create_transactions", {
      transactions: [
        { type: "expense", amount: 2500, description: "a", date: "2026-11-02", category: "אוכל" },
      ],
    });
    const { budgets } = await ok("finance_summary", { month: "2026-11" });
    expect(budgets.find((b: { category: string }) => b.category === "אוכל")).toMatchObject({
      budget: 2000,
      spent: 2500,
      over: true,
    });
    const one = await ok("set_budget", { category: "חשבונות", amount: null });
    expect(one).toEqual([{ category: "אוכל", budget: 2000 }]);
  });

  it("preferences merge, and null clears", async () => {
    await ok("update_preferences", { userName: "ליאור", currency: "USD" });
    const next = await ok("update_preferences", { weekStart: 1 });
    expect(next).toMatchObject({ userName: "ליאור", currency: "USD", weekStart: 1 });
    expect((await ok("update_preferences", { userName: null })).userName).toBeUndefined();
    expect((await ok("get_preferences")).currency).toBe("USD");
    expect((await ok("today")).month.currency).toBe("USD");
    expect((await call("update_preferences", { weekStart: 3 })).isError).toBe(true);
  });

  it("links two items that exist, once", async () => {
    const task = await ok("create_task", { title: "a" });
    const event = await ok("create_event", { title: "b", date: "2026-11-10" });
    const args = { aKind: "task", aId: task.id, bKind: "event", bId: event.id };
    const link = await ok("link_items", args);
    expect((await ok("link_items", args)).id).toBe(link.id);
    expect(await ok("list_links", { id: event.id })).toHaveLength(1);
    const ghost = await call("link_items", { ...args, bId: "nope" });
    expect(ghost.text).toMatch(/No event with id nope/);
    const self = await call("link_items", { ...args, bKind: "task", bId: task.id });
    expect(self.isError).toBe(true);
    await ok("unlink_items", { id: link.id });
    expect(await ok("list_links")).toEqual([]);
  });
});

describe("living beside the app", () => {
  it("the app sees that someone else wrote", async () => {
    const app = new DatabaseSync(file);
    try {
      const version = () =>
        (app.prepare("PRAGMA data_version").get() as { data_version: number })
          .data_version;
      const before = version();
      expect(version()).toBe(before);
      await ok("create_task", { title: "a" });
      expect(version()).not.toBe(before);
      // Its own writes don't count, so a reload doesn't set off another.
      const after = version();
      app.exec("UPDATE settings SET value = value");
      expect(version()).toBe(after);
    } finally {
      app.close();
    }
  });

  it("waits when the file is busy rather than failing", async () => {
    const database = await openWritable(file);
    opened.push(database);
    const row = await database.get<{ timeout: number }>("PRAGMA busy_timeout");
    expect(row?.timeout).toBe(5000);
    const keys = await database.get<{ foreign_keys: number }>("PRAGMA foreign_keys");
    expect(keys?.foreign_keys).toBe(1);
  });

  it("goes out to other computers when sync is on", async () => {
    const app = new DatabaseSync(file);
    app.exec(
      "INSERT OR REPLACE INTO _sync_meta (k, v) VALUES ('dev', 'this-computer'), ('on', '1')",
    );
    app.close();
    const task = await ok("create_task", { title: "a" });
    await ok("update_task", { id: task.id, title: "b" });
    await ok("delete_task", { id: task.id });
    const rows = peek<{ op: string; c: string | null }>(
      file,
      "SELECT op, c FROM _sync_out WHERE r = ? ORDER BY seq",
      task.id,
    );
    expect(rows.map((r) => r.op)).toEqual(
      expect.arrayContaining(["ins", "set", "del"]),
    );
    expect(rows.find((r) => r.op === "set")?.c).toBe("title");
  });

  it("backs up once a day, before the first change", async () => {
    const backup = path.join(path.dirname(file), "backups", `backup-${TODAY}.db`);
    expect(existsSync(backup)).toBe(false);
    await ok("today");
    expect(existsSync(backup)).toBe(false);

    await ok("create_task", { title: "first" });
    expect(existsSync(backup)).toBe(true);
    expect(peek(backup, "SELECT id FROM tasks")).toEqual([]);

    const written = statSync(backup).mtimeMs;
    await ok("create_task", { title: "second" });
    expect(statSync(backup).mtimeMs).toBe(written);
  });

  it("leaves the backup the app already made today", async () => {
    const folder = path.join(path.dirname(file), "backups");
    mkdirSync(folder);
    const backup = path.join(folder, `backup-${TODAY}.db`);
    writeFileSync(backup, "the app's");
    await ok("create_task", { title: "a" });
    expect(readFileSync(backup, "utf8")).toBe("the app's");
  });

  it.each([
    [-1, /older than this server/],
    [1, /newer than this server/],
  ])("won't write to another schema (%i), but still reads", async (shift, message) => {
    const app = new DatabaseSync(file);
    app.exec(`PRAGMA user_version = ${MIGRATIONS.length + shift}`);
    app.close();
    const answer = await call("create_task", { title: "a" });
    expect(answer.isError).toBe(true);
    expect(answer.text).toMatch(message);
    expect(peek(file, "SELECT id FROM tasks")).toEqual([]);
    expect((await call("list_tasks")).isError).toBe(false);
  });
});

describe("the bundle", () => {
  it("writes with --write and not without", async () => {
    const bundle = await buildMcp(path.join(dir, "mymanage-mcp.mjs"));
    const start = async (...flags: string[]) => {
      const stdio = new Client({ name: "test", version: "0" });
      await stdio.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: ["--experimental-sqlite", "--no-warnings", bundle, "--db", file, ...flags],
          stderr: "pipe",
        }),
      );
      return stdio;
    };

    const reading = await start();
    try {
      const names = (await reading.listTools()).tools.map((t) => t.name);
      expect(names).not.toContain("create_task");
    } finally {
      await reading.close();
    }

    const writing = await start("--write");
    try {
      const response = await writing.callTool({
        name: "create_task",
        arguments: { title: "מהצ'אט" },
      });
      expect(response.isError).toBeFalsy();
    } finally {
      await writing.close();
    }
    expect(peek(file, "SELECT title FROM tasks")).toEqual([{ title: "מהצ'אט" }]);
  }, 60_000);
});
