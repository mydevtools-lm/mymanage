import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { setRepoDb, type Db, type SqlValue } from "../src/lib/db-adapter";
import { seedDefaults } from "../src/lib/db";
import { BASE_SCHEMA, MIGRATIONS } from "../src/lib/schema";
import * as repo from "../src/lib/repo";
import { buildMcp } from "../scripts/build-mcp.mjs";
import { openReadOnly, resolveDbPath } from "./readonly-db";
import { createServer } from "./tools";

/**
 * The MCP server (ד9) against a real database file: what each tool returns,
 * that nothing can write, and the bundle Claude would actually start.
 */

const TODAY = "2026-10-18";
const MONTH = "2026-10";

let dir: string;
let file: string;

/** A writable adapter, only to seed the file the way the app would. */
function writable(database: DatabaseSync): Db {
  return {
    async all<T>(sql: string, params: SqlValue[] = []) {
      return database.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (database.prepare(sql).get(...params) ?? null) as T | null;
    },
    async run(sql: string, params: SqlValue[] = []) {
      database.prepare(sql).run(...params);
    },
    async batch(statements) {
      database.exec("BEGIN");
      for (const { sql, params } of statements) {
        if (params) database.prepare(sql).run(...params);
        else database.exec(sql);
      }
      database.exec("COMMIT");
    },
  };
}

const sha = (f: string) =>
  createHash("sha256").update(readFileSync(f)).digest("hex");

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "mymanage-mcp-"));
  file = path.join(dir, "data.db");
  const database = new DatabaseSync(file);
  database.exec("PRAGMA journal_mode = DELETE;");
  database.exec(BASE_SCHEMA);
  MIGRATIONS.forEach((sql, version) => {
    database.exec(sql);
    database.exec(`PRAGMA user_version = ${version + 1}`);
  });
  seedDefaults(database);
  setRepoDb(writable(database));

  const [work] = await repo.listCategories();
  await repo.createTask({
    id: "t-overdue",
    title: "Renew the passport",
    dueDate: "2026-10-10",
    priority: "high",
  });
  await repo.createTask({
    id: "t-today",
    title: "Call the plumber",
    dueDate: TODAY,
    dueTime: "09:30",
    priority: "normal",
    categoryId: work.id,
  });
  await repo.createTask({
    id: "t-done",
    title: "Pay the rent",
    dueDate: TODAY,
    priority: "normal",
    completed: true,
  });
  await repo.createTask({
    id: "t-later",
    title: "Book the dentist",
    dueDate: "2026-10-25",
    priority: "low",
  });
  await repo.createTask({
    id: "t-nodate",
    title: "Sort the garage",
    priority: "low",
  });
  await repo.createEvent({
    id: "e-1",
    title: "Lunch with Dana",
    date: TODAY,
    startTime: "13:00",
    endTime: "14:00",
    allDay: false,
    color: "lavender",
  });
  await repo.createEvent({
    id: "e-weekly",
    title: "Yoga",
    date: "2026-10-04",
    startTime: "18:30",
    allDay: false,
    color: "teal",
    repeat: { kind: "weekly", days: [0] },
  });
  await repo.createTransaction({
    id: "x-1",
    type: "expense",
    amount: 240,
    description: "Groceries",
    date: "2026-10-12",
  });
  await repo.createTransaction({
    id: "x-2",
    type: "income",
    amount: 12000,
    description: "Salary",
    date: "2026-10-01",
  });
  await repo.createTransaction({
    id: "x-3",
    type: "expense",
    amount: 3000,
    description: "Rent",
    date: "2026-10-02",
    recurring: { startMonth: "2026-09" },
  });
  await repo.createNote({
    id: "n-1",
    title: "Gift ideas",
    body: "A book for Dana, and a plant",
    pinned: true,
  });
  await repo.createChecklist("Shopping", ["Milk", "Bread"], "l-1");
  await repo.createRoutine({
    id: "r-1",
    title: "Take the pills",
    priority: "normal",
    repeat: { kind: "daily" },
    startDate: "2026-10-01",
  });
  database.close();
}, 30_000);

afterAll(() => {
  for (const database of opened) database.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Connections to close before the folder goes (Windows keeps them locked). */
const opened: { close(): void }[] = [];

/** A client wired to a server on this file, in this process. */
async function connect() {
  const database = await openReadOnly(file);
  opened.push(database);
  const server = createServer(database);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const response = await client.callTool({ name, arguments: args });
  const [first] = response.content as { type: string; text: string }[];
  return {
    isError: !!response.isError,
    text: first.text,
    json: response.isError ? null : JSON.parse(first.text),
  };
}

describe("tools", () => {
  it("lists only read-only tools, none for settings or secrets", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "finance_summary",
      "get_note",
      "list_categories",
      "list_checklists",
      "list_events",
      "list_notes",
      "list_tasks",
      "list_transactions",
      "search",
      "today",
    ]);
    for (const tool of tools)
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    expect(JSON.stringify(tools)).not.toMatch(
      /secret|setting|api.?key|password/i,
    );
  });

  it("today: overdue, the day's tasks, events with repeats, routines, the month", async () => {
    const client = await connect();
    const { json } = await call(client, "today", { date: TODAY });
    expect(json.overdue.map((t: { id: string }) => t.id)).toEqual([
      "t-overdue",
    ]);
    expect(json.tasks.map((t: { id: string }) => t.id).sort()).toEqual([
      "t-done",
      "t-today",
    ]);
    // 2026-10-18 is a Sunday: the weekly yoga falls on it.
    expect(json.events.map((e: { title: string }) => e.title).sort()).toEqual([
      "Lunch with Dana",
      "Yoga",
    ]);
    expect(json.routinesDue).toEqual([
      { title: "Take the pills", taskCreated: false },
    ]);
    expect(json.month).toMatchObject({
      month: MONTH,
      income: 12000,
      expense: 3240,
      balance: 8760,
    });
  });

  it("list_tasks filters by status, dates, words and category", async () => {
    const client = await connect();
    const ids = async (args: Record<string, unknown>) =>
      (await call(client, "list_tasks", args)).json.tasks.map(
        (t: { id: string }) => t.id,
      );
    expect(await ids({})).toEqual([
      "t-overdue",
      "t-today",
      "t-later",
      "t-nodate",
    ]);
    expect(await ids({ status: "done" })).toEqual(["t-done"]);
    expect(await ids({ from: TODAY, to: "2026-10-31" })).toEqual([
      "t-today",
      "t-later",
    ]);
    expect(await ids({ query: "PLUMBER" })).toEqual(["t-today"]);
    const [work] = await repo.listCategories();
    expect(await ids({ category: work.name })).toEqual(["t-today"]);
    const limited = (
      await call(client, "list_tasks", { status: "all", limit: 2 })
    ).json;
    expect(limited.tasks).toHaveLength(2);
    expect(limited.total).toBe(5);
  });

  it("list_events expands repeating events inside the range", async () => {
    const client = await connect();
    const { json } = await call(client, "list_events", {
      from: "2026-10-01",
      to: "2026-10-31",
    });
    const yoga = json.events.filter(
      (e: { title: string }) => e.title === "Yoga",
    );
    expect(yoga.map((e: { date: string }) => e.date)).toEqual([
      "2026-10-04",
      "2026-10-11",
      "2026-10-18",
      "2026-10-25",
    ]);
  });

  it("list_transactions and finance_summary count a repeating one in its month", async () => {
    const client = await connect();
    const list = (
      await call(client, "list_transactions", { month: MONTH, type: "expense" })
    ).json;
    expect(
      list.transactions
        .map((t: { description: string }) => t.description)
        .sort(),
    ).toEqual(["Groceries", "Rent"]);
    const summary = (await call(client, "finance_summary", { month: MONTH }))
      .json;
    expect(summary).toMatchObject({
      month: MONTH,
      income: 12000,
      expense: 3240,
      balance: 8760,
    });
    // Neither has a category: they add up under none.
    expect(summary.expensesByCategory).toMatchObject([
      { category: null, amount: 3240 },
    ]);
    // September has the rent too — it starts there.
    const september = (
      await call(client, "finance_summary", { month: "2026-09" })
    ).json;
    expect(september.expense).toBe(3000);
  });

  it("search, notes and lists", async () => {
    const client = await connect();
    const found = (await call(client, "search", { query: "dana" })).json
      .results;
    expect(found.map((r: { kind: string }) => r.kind).sort()).toEqual([
      "event",
      "note",
    ]);
    expect(
      (await call(client, "list_notes", { query: "plant" })).json.notes[0],
    ).toMatchObject({ id: "n-1", pinned: true });
    expect((await call(client, "get_note", { id: "n-1" })).json.body).toBe(
      "A book for Dana, and a plant",
    );
    expect((await call(client, "get_note", { id: "nope" })).isError).toBe(true);
    const lists = (await call(client, "list_checklists", { query: "bread" }))
      .json.checklists;
    expect(lists[0].items.map((i: { text: string }) => i.text)).toEqual([
      "Milk",
      "Bread",
    ]);
  });

  it("rejects a malformed day instead of guessing", async () => {
    const client = await connect();
    const response = await client.callTool({
      name: "today",
      arguments: { date: "tomorrow" },
    });
    expect(response.isError).toBe(true);
  });
});

describe("read only", () => {
  it("the connection refuses writes, and the file doesn't change", async () => {
    const before = { hash: sha(file), mtime: statSync(file).mtimeMs };
    const database = await openReadOnly(file);
    opened.push(database);
    await expect(database.run("DELETE FROM tasks")).rejects.toThrow(
      /only reads/,
    );
    await expect(database.batch([])).rejects.toThrow(/only reads/);
    // Even SQL sent straight to the reading calls can't write.
    await expect(database.all("DELETE FROM tasks")).rejects.toThrow(
      /readonly/i,
    );
    const client = await connect();
    for (const name of [
      "today",
      "list_tasks",
      "finance_summary",
      "list_categories",
    ]) {
      await call(client, name);
    }
    expect({ hash: sha(file), mtime: statSync(file).mtimeMs }).toEqual(before);
    expect((await repo.listTasks()).length).toBe(5);
  });

  it("explains a missing database", () => {
    expect(() => resolveDbPath(path.join(dir, "missing.db"))).toThrow(
      /No database at/,
    );
    expect(() => resolveDbPath(undefined, {})).toThrow(/No database given/);
    expect(resolveDbPath(undefined, { MYMANAGE_DB: file })).toBe(file);
  });
});

describe("the bundle", () => {
  it("starts over stdio, answers, and leaves the database alone", async () => {
    const bundle = await buildMcp(path.join(dir, "mymanage-mcp.mjs"));
    const before = sha(file);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ["--experimental-sqlite", "--no-warnings", bundle, "--db", file],
        stderr: "pipe",
      }),
    );
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(10);
      const { json } = await call(client, "today", { date: TODAY });
      expect(json.tasks).toHaveLength(2);
    } finally {
      await client.close();
    }
    expect(sha(file)).toBe(before);
  }, 60_000);

  it("exits with a clear message when there is no database", async () => {
    const bundle = path.join(dir, "mymanage-mcp.mjs");
    const { spawnSync } = await import("node:child_process");
    const run = spawnSync(
      process.execPath,
      [
        "--experimental-sqlite",
        "--no-warnings",
        bundle,
        "--db",
        path.join(dir, "none.db"),
      ],
      {
        encoding: "utf8",
      },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/No database at/);
  });
});
