import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { setRepoDb, type Db } from "../src/lib/db-adapter";
import { readAll } from "../src/lib/repo";
import { localDateKey } from "../src/lib/keys";
import { expandEvents } from "../src/lib/event-series";
import { occursOn } from "../src/lib/routines";
import { searchAll } from "../src/lib/search";
import type { DataSnapshot, Task } from "../src/lib/types";
import {
  categoryName,
  result,
  shapeChecklist,
  shapeEvent,
  shapeRoutine,
  shapeTask,
} from "./shapes";
import { registerWriteTools } from "./write-tools";

/**
 * The tools a chat gets. The ones in this file only read (ד9): without
 * `--write` the database is opened read-only (readonly-db.ts) and these are
 * all there is. With it, write-tools.ts adds the ones that change data (ד11).
 * Nothing reads the app's secrets either way — the Google Calendar addresses
 * and the Claude key live in an encrypted file outside the database.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = z
  .string()
  .regex(DATE, "yyyy-MM-dd")
  .describe("A day, as yyyy-MM-dd.");
const limit = z
  .number()
  .int()
  .min(1)
  .max(200)
  .optional()
  .describe("How many to return (default 50, at most 200).");

const cap = (n: number | undefined) => Math.min(n ?? 50, 200);

const isOpen = (task: Task) => !task.completed && !task.archivedAt;

const includes = (haystack: string | undefined, needle: string) =>
  (haystack ?? "").toLowerCase().includes(needle.toLowerCase());

const INSTRUCTIONS = `mymanage is one person's organiser: tasks, routines, calendar events, notes and lists.
Use the today tool for today's date and a view of the day. Dates are yyyy-MM-dd, times HH:mm.`;

const WRITE_INSTRUCTIONS = `${INSTRUCTIONS}
Changes show in the app within seconds, and on the person's other computers if they sync.
Find an item's id with a list_ tool or search before changing it. If more than one item could be meant, ask which.
Before deleting anything, say what will go and wait for a yes. A repeating event needs a scope: if the person did not say whether they mean one occurrence, from then on, or all of them, ask.`;

export function createServer(
  database: Db,
  { write = false }: { write?: boolean } = {},
): McpServer {
  // repo.ts works through whichever database is set: here, the one given.
  setRepoDb(database);

  const server = new McpServer(
    { name: "mymanage", version: "1.1.0" },
    { instructions: write ? WRITE_INSTRUCTIONS : INSTRUCTIONS },
  );
  const readOnly = { readOnlyHint: true, openWorldHint: false };
  const snapshot = (): Promise<DataSnapshot> => readAll();

  server.registerTool(
    "today",
    {
      title: "What's on today",
      description:
        "A day at a glance: overdue tasks, the day's tasks, events, and routines due. Defaults to today.",
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
      return result({
        date: today,
        overdue: data.tasks
          .filter((t) => isOpen(t) && t.dueDate && t.dueDate < today)
          .map((t) => shapeTask(t, categories)),
        tasks: dueToday.map((t) => shapeTask(t, categories)),
        events: expandEvents(data.events, today, today).map(shapeEvent),
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
        events: rows.slice(0, cap(n)).map(shapeEvent),
      });
    },
  );

  server.registerTool(
    "search",
    {
      title: "Search everything",
      description:
        "One search across tasks, routines, events, notes and lists (including the items inside lists). Words in any order; Hebrew and English.",
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
        checklists: rows.slice(0, cap(n)).map(shapeChecklist),
      });
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description: "The task categories, by name.",
      annotations: readOnly,
    },
    async () => {
      const { categories } = await snapshot();
      return result(
        categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          color: c.color,
        })),
      );
    },
  );

  server.registerTool(
    "list_routines",
    {
      title: "List routines",
      description:
        "Tasks that come back by themselves (pills, workout, mail), with how often. Each day one is due, a plain task is made from it.",
      inputSchema: { query: z.string().optional(), limit },
      annotations: readOnly,
    },
    async ({ query, limit: n }) => {
      const { routines = [], categories } = await snapshot();
      const rows = routines.filter(
        (r) =>
          !query || includes(r.title, query) || includes(r.description, query),
      );
      return result({
        total: rows.length,
        routines: rows.slice(0, cap(n)).map((r) => shapeRoutine(r, categories)),
      });
    },
  );

  server.registerTool(
    "list_links",
    {
      title: "List links between items",
      description:
        "Pairs of items that belong together: a task and the event it prepares, the payment that settled a bill. Pass an item's id to get only its links.",
      inputSchema: { id: z.string().optional() },
      annotations: readOnly,
    },
    async ({ id }) => {
      const { links = [] } = await snapshot();
      return result(links.filter((l) => !id || l.aId === id || l.bId === id));
    },
  );

  if (write) registerWriteTools(server);

  return server;
}
