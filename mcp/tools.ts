import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { setRepoDb, type Db } from "../src/lib/db-adapter";
import { readAll } from "../src/lib/repo";
import { localDateKey, localMonthKey } from "../src/lib/keys";
import { expandEvents } from "../src/lib/event-series";
import {
  budgetStatus,
  categoryBreakdown,
  getMonthTransactions,
  summarize,
} from "../src/lib/finance";
import { occursOn } from "../src/lib/routines";
import { searchAll } from "../src/lib/search";
import type { Category, DataSnapshot, Task } from "../src/lib/types";

/**
 * The tools Claude gets (ד9). Every one only reads: the database is opened
 * read-only (readonly-db.ts) and nothing here asks it to write. Nothing reads
 * the app's secrets either — the Google Calendar addresses and the Claude key
 * live in an encrypted file outside the database, and settings are not
 * exposed beyond the currency.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const date = z
  .string()
  .regex(DATE, "yyyy-MM-dd")
  .describe("A day, as yyyy-MM-dd.");
const month = z
  .string()
  .regex(MONTH, "yyyy-MM")
  .describe("A month, as yyyy-MM.");
const limit = z
  .number()
  .int()
  .min(1)
  .max(200)
  .optional()
  .describe("How many to return (default 50, at most 200).");

const cap = (n: number | undefined) => Math.min(n ?? 50, 200);

function result(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function categoryName(categories: Category[], id: string | undefined) {
  return id ? (categories.find((c) => c.id === id)?.name ?? null) : null;
}

function shapeTask(task: Task, categories: Category[]) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    category: categoryName(categories, task.categoryId),
    completed: task.completed,
    completedAt: task.completedAt,
    archived: !!task.archivedAt,
    subtasks: task.subtasks?.map((s) => ({ text: s.text, done: s.done })),
  };
}

const isOpen = (task: Task) => !task.completed && !task.archivedAt;

const includes = (haystack: string | undefined, needle: string) =>
  (haystack ?? "").toLowerCase().includes(needle.toLowerCase());

export function createServer(database: Db): McpServer {
  // repo.ts reads through whichever database is set; here, the read-only one.
  setRepoDb(database);

  const server = new McpServer({ name: "mymanage", version: "1.0.0" });
  const readOnly = { readOnlyHint: true, openWorldHint: false };
  const snapshot = (): Promise<DataSnapshot> => readAll();

  server.registerTool(
    "today",
    {
      title: "What's on today",
      description:
        "A day at a glance: overdue tasks, the day's tasks, events, routines due, and the month's income, expenses and balance so far. Defaults to today.",
      inputSchema: { date: date.optional() },
      annotations: readOnly,
    },
    async ({ date: day }) => {
      const today = day ?? localDateKey();
      const data = await snapshot();
      const { categories } = data;
      const dueToday = data.tasks.filter(
        (t) => !t.archivedAt && t.dueDate === today,
      );
      const month = today.slice(0, 7);
      return result({
        date: today,
        overdue: data.tasks
          .filter((t) => isOpen(t) && t.dueDate && t.dueDate < today)
          .map((t) => shapeTask(t, categories)),
        tasks: dueToday.map((t) => shapeTask(t, categories)),
        events: expandEvents(data.events, today, today).map((e) => ({
          id: e.seriesId ?? e.id,
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
          allDay: e.allDay,
          location: e.location,
        })),
        routinesDue: (data.routines ?? [])
          .filter((r) => occursOn(r, today))
          .map((r) => ({
            title: r.title,
            time: r.dueTime,
            // Copies are made when the app is open that day.
            taskCreated: data.tasks.some(
              (t) => t.routineId === r.id && t.dueDate === today,
            ),
          })),
        month: {
          month,
          ...summarize(getMonthTransactions(data.transactions, month)),
          currency: data.settings.prefs?.currency ?? "ILS",
        },
      });
    },
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "Tasks, newest first inside each day. By default only open ones. `from`/`to` filter by due date and leave out tasks with no date.",
      inputSchema: {
        status: z
          .enum(["open", "done", "archived", "all"])
          .optional()
          .describe("Default open."),
        from: date.optional(),
        to: date.optional(),
        query: z
          .string()
          .optional()
          .describe("Words in the title or the description."),
        category: z.string().optional().describe("A category name."),
        limit,
      },
      annotations: readOnly,
    },
    async ({ status = "open", from, to, query, category, limit: n }) => {
      const { tasks, categories } = await snapshot();
      const rows = tasks
        .filter((t) => {
          if (status === "open" && !isOpen(t)) return false;
          if (status === "done" && !(t.completed && !t.archivedAt))
            return false;
          if (status === "archived" && !t.archivedAt) return false;
          if (from && !(t.dueDate && t.dueDate >= from)) return false;
          if (to && !(t.dueDate && t.dueDate <= to)) return false;
          if (
            query &&
            !includes(t.title, query) &&
            !includes(t.description, query)
          )
            return false;
          if (
            category &&
            categoryName(categories, t.categoryId)?.toLowerCase() !==
              category.toLowerCase()
          )
            return false;
          return true;
        })
        .sort((a, b) =>
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
        );
      return result({
        total: rows.length,
        tasks: rows.slice(0, cap(n)).map((t) => shapeTask(t, categories)),
      });
    },
  );

  server.registerTool(
    "list_events",
    {
      title: "List calendar events",
      description:
        "The app's own calendar events between two days, repeating ones included as they fall in the range. Google Calendar events are not stored in the app and are not here.",
      inputSchema: { from: date, to: date, limit },
      annotations: readOnly,
    },
    async ({ from, to, limit: n }) => {
      const { events } = await snapshot();
      const rows = expandEvents(events, from, to).sort((a, b) =>
        `${a.date} ${a.startTime ?? ""}`.localeCompare(
          `${b.date} ${b.startTime ?? ""}`,
        ),
      );
      return result({
        total: rows.length,
        events: rows.slice(0, cap(n)).map((e) => ({
          id: e.seriesId ?? e.id,
          title: e.title,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          allDay: e.allDay,
          location: e.location,
          notes: e.notes,
        })),
      });
    },
  );

  server.registerTool(
    "list_transactions",
    {
      title: "List transactions",
      description:
        "A month's income and expenses, newest first, with repeating ones as they fall in that month. Amounts are positive; `type` says which way. Defaults to this month.",
      inputSchema: {
        month: month.optional(),
        type: z.enum(["income", "expense"]).optional(),
        category: z.string().optional().describe("A category name."),
        query: z.string().optional().describe("Words in the description."),
        limit,
      },
      annotations: readOnly,
    },
    async ({ month: m = localMonthKey(), type, category, query, limit: n }) => {
      const { transactions, categories, settings } = await snapshot();
      const rows = getMonthTransactions(transactions, m).filter((t) => {
        if (type && t.type !== type) return false;
        if (query && !includes(t.description, query)) return false;
        if (
          category &&
          categoryName(categories, t.categoryId)?.toLowerCase() !==
            category.toLowerCase()
        )
          return false;
        return true;
      });
      return result({
        month: m,
        currency: settings.prefs?.currency ?? "ILS",
        total: rows.length,
        transactions: rows.slice(0, cap(n)).map((t) => ({
          id: t.id,
          date: t.date,
          type: t.type,
          amount: t.amount,
          description: t.description,
          category: categoryName(categories, t.categoryId),
          notes: t.notes,
          recurring: !!t.recurring,
        })),
      });
    },
  );

  server.registerTool(
    "finance_summary",
    {
      title: "Month summary",
      description:
        "A month's income, expenses and balance, expenses and income by category, and each budgeted category against what was spent. Defaults to this month.",
      inputSchema: { month: month.optional() },
      annotations: readOnly,
    },
    async ({ month: m = localMonthKey() }) => {
      const { transactions, categories, settings } = await snapshot();
      const rows = getMonthTransactions(transactions, m);
      const byCategory = (type: "expense" | "income") =>
        categoryBreakdown(rows, categories, type).map((c) => ({
          category: c.category?.name ?? null,
          amount: c.amount,
          share: Math.round(c.share * 1000) / 10,
        }));
      return result({
        month: m,
        currency: settings.prefs?.currency ?? "ILS",
        ...summarize(rows),
        expensesByCategory: byCategory("expense"),
        incomeByCategory: byCategory("income"),
        budgets: budgetStatus(rows, settings.budgets).map((b) => ({
          category: categoryName(categories, b.categoryId),
          budget: b.budget,
          spent: b.spent,
          over: b.over,
        })),
      });
    },
  );

  server.registerTool(
    "search",
    {
      title: "Search everything",
      description:
        "One search across tasks, routines, events, transactions, notes and lists (including the items inside lists). Words in any order; Hebrew and English.",
      inputSchema: { query: z.string().min(1), limit },
      annotations: readOnly,
    },
    async ({ query, limit: n }) => {
      const data = await snapshot();
      const found = searchAll(query, data, localDateKey(), cap(n));
      return result({
        total: found.length,
        results: found.map((r) => ({
          kind: r.kind,
          id: r.id,
          title: r.title,
          detail: r.detail,
        })),
      });
    },
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description:
        "Notes, pinned first, each with the start of its text. Use get_note for a whole note.",
      inputSchema: {
        query: z.string().optional().describe("Words in the title or text."),
        limit,
      },
      annotations: readOnly,
    },
    async ({ query, limit: n }) => {
      const { notes } = await snapshot();
      const rows = notes
        .filter(
          (note) =>
            !query || includes(note.title, query) || includes(note.body, query),
        )
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
      return result({
        total: rows.length,
        notes: rows.slice(0, cap(n)).map((note) => ({
          id: note.id,
          title: note.title,
          pinned: !!note.pinned,
          updatedAt: note.updatedAt,
          preview: note.body.slice(0, 200),
        })),
      });
    },
  );

  server.registerTool(
    "get_note",
    {
      title: "Read a note",
      description: "One note in full.",
      inputSchema: { id: z.string() },
      annotations: readOnly,
    },
    async ({ id }) => {
      const { notes } = await snapshot();
      const note = notes.find((n) => n.id === id);
      if (!note) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `No note with id ${id}.` }],
        };
      }
      return result({
        id: note.id,
        title: note.title,
        pinned: !!note.pinned,
        body: note.body,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      });
    },
  );

  server.registerTool(
    "list_checklists",
    {
      title: "List checklists",
      description:
        "Lists with their items and which are done. Pass `query` to find one by title or by an item in it.",
      inputSchema: { query: z.string().optional(), limit },
      annotations: readOnly,
    },
    async ({ query, limit: n }) => {
      const { checklists } = await snapshot();
      const rows = checklists
        .filter(
          (list) =>
            !query ||
            includes(list.title, query) ||
            list.items.some((item) => includes(item.text, query)),
        )
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
      return result({
        total: rows.length,
        checklists: rows.slice(0, cap(n)).map((list) => ({
          id: list.id,
          title: list.title,
          pinned: !!list.pinned,
          items: list.items.map((item) => ({
            text: item.text,
            done: item.done,
          })),
        })),
      });
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description: "The task and money categories, by name.",
      annotations: readOnly,
    },
    async () => {
      const { categories } = await snapshot();
      return result(
        categories.map((c) => ({ name: c.name, kind: c.kind, color: c.color })),
      );
    },
  );

  return server;
}
