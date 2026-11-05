import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as repo from "../src/lib/repo";
import {
  fallsOn,
  planEventDelete,
  planEventEdit,
  type EventFields,
} from "../src/lib/event-series";
import { planSeriesDelete, planSeriesEdit } from "../src/lib/finance";
import type {
  CalendarEvent,
  CategoryKind,
  LinkKind,
  SeriesScope,
  Subtask,
  Task,
  Transaction,
} from "../src/lib/types";
import {
  categoryName,
  result,
  shapeChecklist,
  shapeEvent,
  shapeRoutine,
  shapeTask,
} from "./shapes";

/**
 * The tools that change data (ד11), registered only with --write. They go
 * through repo.ts, like the app's own screens, and follow the same rules the
 * screens do (store.ts, api-routes.ts): ticking a task files it away, a new
 * routine makes today's copy, a change to a repeating item goes through the
 * same plans. The sync triggers see these writes like any other.
 *
 * Not offered: wiping or replacing everything, sample data, sync, Google
 * Calendar settings and secrets. Those stay on the Settings screen.
 *
 * A thrown Error reaches the chat as a failed tool call with that message, so
 * messages say what to do next. They are read by the model, in English.
 */

/* ---------------------------------------------------------------- fields */

const isRealDay = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-MM-dd")
  .refine(isRealDay, "Not a day on the calendar.")
  .describe("A day, as yyyy-MM-dd.");
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "yyyy-MM")
  .describe("A month, as yyyy-MM.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm")
  .describe("A time of day, as HH:mm.");
const text = z.string().trim().min(1);
const priority = z.enum(["low", "normal", "high", "urgent"]);
const color = z.enum([
  "teal",
  "coral",
  "lavender",
  "amber",
  "sky",
  "mint",
  "rose",
  "slate",
]);
const repeat = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("daily") }),
    z.object({
      kind: z.literal("weekly"),
      days: z
        .array(z.number().int().min(0).max(6))
        .min(1)
        .describe("Days of the week, 0 Sunday to 6 Saturday."),
    }),
    z.object({
      kind: z.literal("monthly"),
      day: z.number().int().min(1).max(31),
    }),
    z.object({ kind: z.literal("yearly") }),
  ])
  .describe("How often it comes back.");
const reminder = z
  .number()
  .int()
  .min(0)
  .describe("Minutes before the time to remind.");
const scope = z
  .enum(["this", "following", "all"])
  .describe(
    "For a repeating item: only this occurrence, this one and those after it, or all of them. Required for a repeating item, ignored otherwise.",
  );
const taskCategory = z.string().describe("A task category, by name or id.");
const moneyCategory = z.string().describe("A money category, by name or id.");
const amount = z
  .number()
  .positive()
  .describe("Always positive; `type` says which way the money went.");
const linkKind = z.enum(["task", "event", "transaction", "note", "list"]);

const orClear = "Pass null to clear.";

/* --------------------------------------------------------------- helpers */

/**
 * Builds a patch for repo.ts from a tool's arguments. A field left out stays
 * out of the patch; null means "clear it", which repo.ts takes as undefined.
 */
function patchOf<T extends object>(args: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) patch[key] = value ?? undefined;
  }
  return patch as Partial<T>;
}

function must<T>(found: T | null | undefined, what: string, id: string): T {
  if (!found) {
    throw new Error(
      `No ${what} with id ${id}. Find the id with a list_ tool or search.`,
    );
  }
  return found;
}

async function resolveCategory(
  value: string,
  kind: CategoryKind,
): Promise<string> {
  const all = (await repo.listCategories()).filter((c) => c.kind === kind);
  const wanted = value.trim().toLowerCase();
  const found = all.find(
    (c) => c.id === value || c.name.toLowerCase() === wanted,
  );
  if (found) return found.id;
  const names = all.map((c) => c.name).join(", ");
  throw new Error(
    `No ${kind} category "${value}". There are: ${names}. Use one of them, or create_category first.`,
  );
}

/** undefined stays out of the patch; null clears; a name becomes an id. */
async function categoryField(
  value: string | null | undefined,
  kind: CategoryKind,
) {
  if (value === undefined) return {};
  return {
    categoryId: value === null ? undefined : await resolveCategory(value, kind),
  };
}

/** What a new item with a time gets when the chat doesn't ask for a reminder:
 *  the default the screens start their forms with. */
async function reminderFor(given: number | undefined, hasTime: boolean) {
  if (given !== undefined) return given;
  return hasTime ? (await repo.getPrefs()).defaultReminder : undefined;
}

function checkOccurrence(
  series: CalendarEvent,
  wanted: SeriesScope | undefined,
  occurrenceDate: string | undefined,
): SeriesScope {
  if (!series.repeat) return "all";
  if (!wanted) {
    throw new Error(
      `"${series.title}" repeats. Pass scope: this, following or all. If the person did not say, ask them.`,
    );
  }
  if (wanted !== "all" && !occurrenceDate) {
    throw new Error(
      `Scope ${wanted} needs occurrenceDate: the occurrenceDate list_events shows for that day.`,
    );
  }
  if (occurrenceDate && !fallsOn(series, occurrenceDate)) {
    throw new Error(`"${series.title}" has no occurrence on ${occurrenceDate}.`);
  }
  return wanted;
}

function checkMonth(
  series: Transaction,
  wanted: SeriesScope | undefined,
  monthKey: string | undefined,
): SeriesScope {
  if (!series.recurring) return "all";
  if (!wanted) {
    throw new Error(
      `"${series.description}" repeats every month. Pass scope: this, following or all. If the person did not say, ask them.`,
    );
  }
  if (wanted === "all") return wanted;
  if (!monthKey) throw new Error(`Scope ${wanted} needs month.`);
  const { startMonth, endMonth } = series.recurring;
  if (monthKey < startMonth || (endMonth && monthKey > endMonth)) {
    throw new Error(
      `"${series.description}" runs from ${startMonth}${endMonth ? ` to ${endMonth}` : ""}, which doesn't include ${monthKey}.`,
    );
  }
  return wanted;
}

function checkRecurring(
  recurring: { startMonth?: string; endMonth?: string },
  date: string,
) {
  const startMonth = recurring.startMonth ?? date.slice(0, 7);
  if (recurring.endMonth && recurring.endMonth < startMonth) {
    throw new Error(
      `endMonth ${recurring.endMonth} is before startMonth ${startMonth}.`,
    );
  }
  return { startMonth, endMonth: recurring.endMonth };
}

async function shapeTransaction(t: Transaction) {
  return {
    id: t.id,
    date: t.date,
    type: t.type,
    amount: t.amount,
    description: t.description,
    category: categoryName(await repo.listCategories(), t.categoryId),
    notes: t.notes,
    recurring: t.recurring ?? null,
    exceptions: t.exceptions,
  };
}

async function itemExists(kind: LinkKind, id: string) {
  switch (kind) {
    case "task":
      return !!(await repo.getTask(id));
    case "event":
      return !!(await repo.getEvent(id));
    case "transaction":
      return !!(await repo.getTransaction(id));
    case "note":
      return !!(await repo.getNote(id));
    case "list":
      return !!(await repo.getChecklist(id));
  }
}

/* ----------------------------------------------------------------- tools */

export function registerWriteTools(server: McpServer) {
  const adds = {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  };
  const changes = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  };
  const removes = changes;

  /* -------------------------------------------------------------- tasks */

  server.registerTool(
    "create_task",
    {
      title: "Add a task",
      description: "Adds a task. Only the title is needed.",
      inputSchema: {
        title: text,
        description: z.string().optional(),
        dueDate: day.optional(),
        dueTime: time.optional().describe("HH:mm. Needs dueDate."),
        priority: priority.optional().describe("Default normal."),
        category: taskCategory.optional(),
        reminder: reminder.optional(),
        subtasks: z.array(text).optional().describe("Steps, in order."),
      },
      annotations: adds,
    },
    async ({ dueTime, category, subtasks, reminder: given, ...fields }) => {
      if (dueTime && !fields.dueDate) {
        throw new Error("A dueTime needs a dueDate.");
      }
      const task = await repo.createTask({
        ...fields,
        dueTime,
        ...(await categoryField(category, "task")),
        reminder: await reminderFor(given, !!dueTime),
        subtasks: subtasks?.map((line) => ({
          id: crypto.randomUUID(),
          text: line,
          done: false,
        })),
      });
      return result(shapeTask(task, await repo.listCategories()));
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Change a task",
      description: `Changes a task: send only what changes. ${orClear} completed: true ticks it and files it away, as the app does; false reopens it. archived: true files it away unfinished; false brings it back open.`,
      inputSchema: {
        id: z.string(),
        title: text.optional(),
        description: z.string().nullable().optional(),
        dueDate: day.nullable().optional(),
        dueTime: time.nullable().optional(),
        priority: priority.optional(),
        category: taskCategory.nullable().optional(),
        reminder: reminder.nullable().optional(),
        completed: z.boolean().optional(),
        archived: z.boolean().optional(),
        subtasks: z
          .array(
            z.object({
              id: z.string().optional().describe("Keep it for an existing one."),
              text,
              done: z.boolean().optional(),
            }),
          )
          .optional()
          .describe("The whole list of steps, replacing the old one."),
      },
      annotations: changes,
    },
    async ({ id, category, completed, archived, subtasks, ...fields }) => {
      const task = must(await repo.getTask(id), "task", id);
      const patch: Partial<Task> = {
        ...patchOf<Task>(fields),
        ...(await categoryField(category, "task")),
      };

      const nextDate = "dueDate" in patch ? patch.dueDate : task.dueDate;
      const nextTime = "dueTime" in patch ? patch.dueTime : task.dueTime;
      if (fields.dueDate === null) patch.dueTime = undefined;
      else if (nextTime && !nextDate) {
        throw new Error("A dueTime needs a dueDate.");
      }

      const stamp = new Date().toISOString();
      if (completed === true) {
        Object.assign(patch, {
          completed: true,
          completedAt: stamp,
          archivedAt: stamp,
        });
      } else if (completed === false || archived === false) {
        Object.assign(patch, {
          completed: false,
          completedAt: undefined,
          archivedAt: undefined,
        });
      } else if (archived === true) {
        patch.archivedAt = stamp;
      }

      if (subtasks) {
        patch.subtasks = subtasks.map(
          (step): Subtask => ({
            id: step.id ?? crypto.randomUUID(),
            text: step.text,
            done: !!step.done,
          }),
        );
      }
      const updated = await repo.updateTask(id, patch);
      return result(shapeTask(updated!, await repo.listCategories()));
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete a task",
      description:
        "Deletes a task for good. To finish one, use update_task with completed: true instead.",
      inputSchema: { id: z.string() },
      annotations: removes,
    },
    async ({ id }) => {
      const task = must(await repo.getTask(id), "task", id);
      await repo.deleteTask(id);
      return result({ deleted: { id, title: task.title } });
    },
  );

  /* ----------------------------------------------------------- routines */

  server.registerTool(
    "create_routine",
    {
      title: "Add a routine",
      description:
        "Adds a task that comes back by itself. If it falls today, today's task is made with it.",
      inputSchema: {
        title: text,
        repeat,
        description: z.string().optional(),
        priority: priority.optional().describe("Default normal."),
        category: taskCategory.optional(),
        dueTime: time.optional(),
        startDate: day.optional().describe("Default today."),
      },
      annotations: adds,
    },
    async ({ category, ...fields }) => {
      const routine = await repo.createRoutine({
        ...fields,
        ...(await categoryField(category, "task")),
      });
      await repo.ensureRoutineCopies();
      return result(shapeRoutine(routine, await repo.listCategories()));
    },
  );

  server.registerTool(
    "update_routine",
    {
      title: "Change a routine",
      description: `Changes a routine from now on: send only what changes. ${orClear} Today's task, if still open, follows. paused: true stops new tasks without deleting it.`,
      inputSchema: {
        id: z.string(),
        title: text.optional(),
        description: z.string().nullable().optional(),
        priority: priority.optional(),
        category: taskCategory.nullable().optional(),
        dueTime: time.nullable().optional(),
        repeat: repeat.optional(),
        startDate: day.optional(),
        paused: z.boolean().optional(),
      },
      annotations: changes,
    },
    async ({ id, category, ...fields }) => {
      must(await repo.getRoutine(id), "routine", id);
      const updated = await repo.updateRoutine(id, {
        ...patchOf(fields),
        ...(await categoryField(category, "task")),
      });
      return result(shapeRoutine(updated!, await repo.listCategories()));
    },
  );

  server.registerTool(
    "delete_routine",
    {
      title: "Delete a routine",
      description:
        "Deletes a routine for good. Tasks it already made stay. To stop it for a while, use update_routine with paused: true.",
      inputSchema: { id: z.string() },
      annotations: removes,
    },
    async ({ id }) => {
      const routine = must(await repo.getRoutine(id), "routine", id);
      await repo.deleteRoutine(id);
      return result({ deleted: { id, title: routine.title } });
    },
  );

  /* ------------------------------------------------------------- events */

  server.registerTool(
    "create_event",
    {
      title: "Add a calendar event",
      description:
        "Adds an event to the app's own calendar (not to Google Calendar). Without startTime it is an all-day event.",
      inputSchema: {
        title: text,
        date: day,
        startTime: time.optional(),
        endTime: time.optional().describe("HH:mm. Needs startTime."),
        location: z.string().optional(),
        notes: z.string().optional(),
        color: color.optional(),
        reminder: reminder.optional(),
        repeat: repeat.optional(),
        until: day.optional().describe("Last day of a repeating event."),
      },
      annotations: adds,
    },
    async ({ reminder: given, ...fields }) => {
      if (fields.endTime && !fields.startTime) {
        throw new Error("An endTime needs a startTime.");
      }
      if (fields.until && !fields.repeat) {
        throw new Error("until only applies to a repeating event.");
      }
      if (fields.until && fields.until < fields.date) {
        throw new Error(`until ${fields.until} is before ${fields.date}.`);
      }
      const event = await repo.createEvent({
        ...fields,
        allDay: !fields.startTime,
        reminder: await reminderFor(given, !!fields.startTime),
      });
      return result(shapeEvent(event));
    },
  );

  server.registerTool(
    "update_event",
    {
      title: "Change a calendar event",
      description: `Changes an event: send only what changes. ${orClear} For a repeating event pass scope, and for this or following also occurrenceDate. allDay: true drops the times.`,
      inputSchema: {
        id: z.string(),
        scope: scope.optional(),
        occurrenceDate: day
          .optional()
          .describe("The occurrenceDate list_events shows for that day."),
        title: text.optional(),
        date: day.optional().describe("Moves it to this day."),
        startTime: time.nullable().optional(),
        endTime: time.nullable().optional(),
        allDay: z.boolean().optional(),
        location: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        color: color.optional(),
        reminder: reminder.nullable().optional(),
        repeat: repeat
          .nullable()
          .optional()
          .describe("With scope all; null makes it a one-off."),
        until: day.nullable().optional(),
      },
      annotations: changes,
    },
    async ({ id, scope: wanted, occurrenceDate, ...args }) => {
      const series = must(await repo.getEvent(id), "event", id);
      const reach = checkOccurrence(series, wanted, occurrenceDate);
      const fields = patchOf<EventFields>(args) as EventFields;
      if (args.allDay === true) {
        fields.startTime = undefined;
        fields.endTime = undefined;
      } else if (args.startTime) {
        fields.allDay = false;
      }

      const plan = planEventEdit(
        series,
        occurrenceDate ?? series.date,
        reach,
        fields,
      );
      if (plan.kind === "delete") {
        await repo.deleteEvent(plan.id);
        return result({ deleted: { id, title: series.title } });
      }
      const updated = await repo.updateEvent(plan.id, plan.patch);
      const created =
        plan.kind === "split" ? await repo.createEvent(plan.create) : null;
      return result({
        updated: shapeEvent(updated!),
        ...(created && { startedAsNewSeries: shapeEvent(created) }),
      });
    },
  );

  server.registerTool(
    "delete_event",
    {
      title: "Delete a calendar event",
      description:
        "Deletes an event for good. For a repeating event pass scope, and for this or following also occurrenceDate.",
      inputSchema: {
        id: z.string(),
        scope: scope.optional(),
        occurrenceDate: day.optional(),
      },
      annotations: removes,
    },
    async ({ id, scope: wanted, occurrenceDate }) => {
      const series = must(await repo.getEvent(id), "event", id);
      const reach = checkOccurrence(series, wanted, occurrenceDate);
      const plan = planEventDelete(
        series,
        occurrenceDate ?? series.date,
        reach,
      );
      if (plan.kind === "delete") {
        await repo.deleteEvent(plan.id);
        return result({ deleted: { id, title: series.title } });
      }
      if (plan.kind === "update") {
        await repo.updateEvent(plan.id, plan.patch);
      }
      return result({
        deleted: { id, title: series.title, scope: reach, occurrenceDate },
      });
    },
  );

  /* ------------------------------------------------------- transactions */

  server.registerTool(
    "create_transactions",
    {
      title: "Add income or expenses",
      description:
        "Adds one or more transactions, all together or none. Give `recurring` for one that repeats every month, on the same day of the month.",
      inputSchema: {
        transactions: z
          .array(
            z.object({
              type: z.enum(["income", "expense"]),
              amount,
              description: text,
              date: day,
              category: moneyCategory.optional(),
              notes: z.string().optional(),
              recurring: z
                .object({
                  startMonth: month
                    .optional()
                    .describe("Default the month of date."),
                  endMonth: month
                    .optional()
                    .describe("Last month, included. Default: no end."),
                })
                .optional(),
            }),
          )
          .min(1)
          .max(200),
      },
      annotations: adds,
    },
    async ({ transactions }) => {
      const rows: Partial<Transaction>[] = [];
      for (const { category, recurring, ...fields } of transactions) {
        rows.push({
          ...fields,
          ...(await categoryField(category, "finance")),
          recurring: recurring && checkRecurring(recurring, fields.date),
        });
      }
      const created = await repo.createTransactions(rows);
      const shaped = [];
      for (const row of created) shaped.push(await shapeTransaction(row));
      return result({ created: shaped });
    },
  );

  server.registerTool(
    "update_transaction",
    {
      title: "Change a transaction",
      description: `Changes a transaction: send only what changes. ${orClear} For a monthly one pass scope, and for this or following also month. Scope this changes only amount, description and category; date and recurring need scope all.`,
      inputSchema: {
        id: z.string(),
        scope: scope.optional(),
        month: month.optional().describe("The month being changed."),
        type: z.enum(["income", "expense"]).optional(),
        amount: amount.optional(),
        description: text.optional(),
        date: day.optional(),
        category: moneyCategory.nullable().optional(),
        notes: z.string().nullable().optional(),
        recurring: z
          .object({ startMonth: month.optional(), endMonth: month.optional() })
          .nullable()
          .optional()
          .describe("Make it monthly, change the months, or null for a one-off."),
      },
      annotations: changes,
    },
    async ({ id, scope: wanted, month: monthKey, category, recurring, ...args }) => {
      const current = must(
        await repo.getTransaction(id),
        "transaction",
        id,
      );
      const reach = checkMonth(current, wanted, monthKey);
      if (reach !== "all" && (args.date || recurring !== undefined)) {
        throw new Error(
          `date and recurring change the whole series: use scope all, not ${reach}.`,
        );
      }
      if (reach === "this" && (args.type || args.notes !== undefined)) {
        throw new Error(
          "One month can only change its amount, description and category.",
        );
      }
      if (reach === "this" && category === null) {
        throw new Error(
          "One month can't drop its category; choose another, or use scope all.",
        );
      }

      const fields: Partial<Transaction> = {
        ...patchOf<Transaction>(args),
        ...(await categoryField(category, "finance")),
      };
      if (recurring !== undefined) {
        fields.recurring = recurring
          ? checkRecurring(
              { ...current.recurring, ...recurring },
              args.date ?? current.date,
            )
          : undefined;
      }

      const plan = planSeriesEdit(
        current,
        monthKey ?? current.date.slice(0, 7),
        reach,
        fields,
      );
      if (plan.kind === "delete") throw new Error("Nothing to change.");
      const updated = await repo.updateTransaction(plan.id, plan.patch);
      const created =
        plan.kind === "split"
          ? await repo.createTransaction(plan.create)
          : null;
      return result({
        updated: await shapeTransaction(updated!),
        ...(created && {
          startedAsNewSeries: await shapeTransaction(created),
        }),
      });
    },
  );

  server.registerTool(
    "delete_transaction",
    {
      title: "Delete a transaction",
      description:
        "Deletes a transaction for good. For a monthly one pass scope, and for this or following also month.",
      inputSchema: {
        id: z.string(),
        scope: scope.optional(),
        month: month.optional(),
      },
      annotations: removes,
    },
    async ({ id, scope: wanted, month: monthKey }) => {
      const current = must(
        await repo.getTransaction(id),
        "transaction",
        id,
      );
      const reach = checkMonth(current, wanted, monthKey);
      const plan = planSeriesDelete(
        current,
        monthKey ?? current.date.slice(0, 7),
        reach,
      );
      if (plan.kind === "delete") await repo.deleteTransaction(plan.id);
      else await repo.updateTransaction(plan.id, plan.patch);
      return result({
        deleted: {
          id,
          description: current.description,
          ...(current.recurring && { scope: reach, month: monthKey }),
        },
      });
    },
  );

  /* -------------------------------------------------------------- notes */

  server.registerTool(
    "create_note",
    {
      title: "Add a note",
      description: "Adds a note. Give a title, a body, or both.",
      inputSchema: {
        title: z.string().trim().optional(),
        body: z.string().optional(),
        pinned: z.boolean().optional(),
        color: color.optional(),
      },
      annotations: adds,
    },
    async (fields) => {
      if (!fields.title && !fields.body) {
        throw new Error("A note needs a title or a body.");
      }
      return result(await repo.createNote(fields));
    },
  );

  server.registerTool(
    "update_note",
    {
      title: "Change a note",
      description:
        "Changes a note: send only what changes. `body` replaces the whole text, so read it first with get_note to add to it.",
      inputSchema: {
        id: z.string(),
        title: z.string().trim().optional(),
        body: z.string().optional(),
        pinned: z.boolean().optional(),
        color: color.nullable().optional(),
      },
      annotations: changes,
    },
    async ({ id, ...fields }) => {
      must(await repo.getNote(id), "note", id);
      return result(await repo.updateNote(id, patchOf(fields)));
    },
  );

  server.registerTool(
    "delete_note",
    {
      title: "Delete a note",
      description: "Deletes a note for good.",
      inputSchema: { id: z.string() },
      annotations: removes,
    },
    async ({ id }) => {
      const note = must(await repo.getNote(id), "note", id);
      await repo.deleteNote(id);
      return result({ deleted: { id, title: note.title } });
    },
  );

  /* --------------------------------------------------------- checklists */

  server.registerTool(
    "create_checklist",
    {
      title: "Add a list",
      description: "Adds a tickable list: shopping, packing, anything.",
      inputSchema: {
        title: text,
        items: z.array(text).optional(),
      },
      annotations: adds,
    },
    async ({ title, items }) =>
      result(shapeChecklist(await repo.createChecklist(title, items ?? []))),
  );

  server.registerTool(
    "update_checklist",
    {
      title: "Change a list",
      description:
        "Renames, pins or tidies a list. uncheckAll unticks every item, for using it again. clearDone removes the ticked items. order gives item ids in the new order.",
      inputSchema: {
        id: z.string(),
        title: text.optional(),
        pinned: z.boolean().optional(),
        uncheckAll: z.boolean().optional(),
        clearDone: z.boolean().optional(),
        order: z.array(z.string()).optional(),
      },
      annotations: changes,
    },
    async ({ id, title, pinned, uncheckAll, clearDone, order }) => {
      must(await repo.getChecklist(id), "list", id);
      if (title) await repo.renameChecklist(id, title);
      if (pinned !== undefined) await repo.setChecklistPinned(id, pinned);
      if (clearDone) await repo.clearDoneChecklistItems(id);
      if (uncheckAll) await repo.resetChecklist(id);
      if (order) await repo.reorderChecklistItems(id, order);
      return result(shapeChecklist((await repo.getChecklist(id))!));
    },
  );

  server.registerTool(
    "delete_checklist",
    {
      title: "Delete a list",
      description: "Deletes a list and everything on it, for good.",
      inputSchema: { id: z.string() },
      annotations: removes,
    },
    async ({ id }) => {
      const list = must(await repo.getChecklist(id), "list", id);
      await repo.deleteChecklist(id);
      return result({ deleted: { id, title: list.title } });
    },
  );

  server.registerTool(
    "add_checklist_items",
    {
      title: "Add to a list",
      description: "Adds items to the end of a list.",
      inputSchema: {
        listId: z.string(),
        items: z.array(text).min(1),
      },
      annotations: adds,
    },
    async ({ listId, items }) => {
      must(await repo.getChecklist(listId), "list", listId);
      for (const item of items) await repo.addChecklistItem(listId, item);
      return result(shapeChecklist((await repo.getChecklist(listId))!));
    },
  );

  server.registerTool(
    "update_checklist_item",
    {
      title: "Tick or change a list item",
      description: "Ticks, unticks or rewords one item.",
      inputSchema: {
        listId: z.string(),
        itemId: z.string(),
        text: text.optional(),
        done: z.boolean().optional(),
      },
      annotations: changes,
    },
    async ({ listId, itemId, text: wording, done }) => {
      const list = must(await repo.getChecklist(listId), "list", listId);
      must(
        list.items.find((item) => item.id === itemId),
        "item on this list",
        itemId,
      );
      const updated = await repo.setChecklistItem(listId, itemId, {
        text: wording,
        done,
      });
      return result(shapeChecklist(updated!));
    },
  );

  server.registerTool(
    "delete_checklist_item",
    {
      title: "Remove a list item",
      description: "Removes one item from a list for good.",
      inputSchema: { listId: z.string(), itemId: z.string() },
      annotations: removes,
    },
    async ({ listId, itemId }) => {
      const list = must(await repo.getChecklist(listId), "list", listId);
      must(
        list.items.find((item) => item.id === itemId),
        "item on this list",
        itemId,
      );
      const updated = await repo.deleteChecklistItem(listId, itemId);
      return result(shapeChecklist(updated!));
    },
  );

  /* --------------------------------------------------------- categories */

  server.registerTool(
    "create_category",
    {
      title: "Add a category",
      description:
        "Adds a category. kind is task for tasks and routines, finance for income and expenses.",
      inputSchema: {
        name: text,
        kind: z.enum(["task", "finance"]),
        color: color.optional().describe("Default slate."),
      },
      annotations: adds,
    },
    async ({ name, kind, color: chosen }) => {
      const all = await repo.listCategories();
      const same = all.find(
        (c) => c.kind === kind && c.name.toLowerCase() === name.toLowerCase(),
      );
      if (same) throw new Error(`There is already a ${kind} category "${name}".`);
      return result(
        await repo.createCategory({ name, kind, color: chosen ?? "slate" }),
      );
    },
  );

  server.registerTool(
    "update_category",
    {
      title: "Change a category",
      description: "Renames or recolours a category. Its id is in list_categories.",
      inputSchema: {
        id: z.string(),
        name: text.optional(),
        color: color.optional(),
      },
      annotations: changes,
    },
    async ({ id, ...fields }) => {
      const updated = await repo.updateCategory(id, patchOf(fields));
      return result(must(updated, "category", id));
    },
  );

  server.registerTool(
    "delete_category",
    {
      title: "Delete a category",
      description:
        "Deletes a category for good. The tasks and transactions in it stay, without a category.",
      inputSchema: { id: z.string() },
      annotations: removes,
    },
    async ({ id }) => {
      const all = await repo.listCategories();
      const category = must(
        all.find((c) => c.id === id),
        "category",
        id,
      );
      await repo.deleteCategory(id);
      return result({ deleted: { id, name: category.name } });
    },
  );

  /* ---------------------------------------------- budgets and preferences */

  server.registerTool(
    "set_budget",
    {
      title: "Set a monthly budget",
      description:
        "Sets the monthly budget of one money category. Other categories keep theirs. amount null removes it. finance_summary shows budgets against spending.",
      inputSchema: {
        category: moneyCategory,
        amount: z.number().positive().nullable(),
      },
      annotations: changes,
    },
    async ({ category, amount: wanted }) => {
      const id = await resolveCategory(category, "finance");
      const budgets = { ...(await repo.getBudgets()) };
      if (wanted === null) delete budgets[id];
      else budgets[id] = wanted;
      const saved = (await repo.setBudgets(budgets)) ?? {};
      const categories = await repo.listCategories();
      return result(
        Object.entries(saved).map(([key, value]) => ({
          category: categoryName(categories, key),
          budget: value,
        })),
      );
    },
  );

  const shapePrefs = async () => {
    const { userName, weekStart, currency, defaultReminder } =
      await repo.getPrefs();
    return { userName, weekStart, currency, defaultReminder };
  };

  server.registerTool(
    "get_preferences",
    {
      title: "Read preferences",
      description:
        "The person's name, first day of the week (0 Sunday, 1 Monday, 6 Saturday), currency, and default reminder in minutes.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => result(await shapePrefs()),
  );

  server.registerTool(
    "update_preferences",
    {
      title: "Change preferences",
      description: `Changes the app's preferences: send only what changes. ${orClear}`,
      inputSchema: {
        userName: z.string().trim().nullable().optional(),
        weekStart: z
          .union([z.literal(0), z.literal(1), z.literal(6)])
          .optional()
          .describe("0 Sunday, 1 Monday, 6 Saturday."),
        currency: z.enum(["ILS", "USD", "EUR"]).optional(),
        defaultReminder: reminder.nullable().optional(),
      },
      annotations: changes,
    },
    async (fields) => {
      const patch = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(patch).length) await repo.setPrefs(patch);
      return result(await shapePrefs());
    },
  );

  /* -------------------------------------------------------------- links */

  server.registerTool(
    "link_items",
    {
      title: "Link two items",
      description:
        "Marks two items as belonging together: a task and the event it prepares, the payment that settled a bill.",
      inputSchema: {
        aKind: linkKind,
        aId: z.string(),
        bKind: linkKind,
        bId: z.string(),
      },
      annotations: adds,
    },
    async (link) => {
      if (link.aId === link.bId) {
        throw new Error("An item can't be linked to itself.");
      }
      if (!(await itemExists(link.aKind, link.aId))) {
        must(null, link.aKind, link.aId);
      }
      if (!(await itemExists(link.bKind, link.bId))) {
        must(null, link.bKind, link.bId);
      }
      return result(await repo.createLink(link));
    },
  );

  server.registerTool(
    "unlink_items",
    {
      title: "Remove a link",
      description: "Removes a link; the two items stay. Its id is in list_links.",
      inputSchema: { id: z.string() },
      annotations: removes,
    },
    async ({ id }) => {
      must(
        (await repo.listLinks()).find((l) => l.id === id),
        "link",
        id,
      );
      await repo.deleteLink(id);
      return result({ deleted: { id } });
    },
  );
}
