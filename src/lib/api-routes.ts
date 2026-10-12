import * as repo from "./repo";
import type {
  CalendarEvent,
  Category,
  DataSnapshot,
  Link,
  Note,
  Routine,
  Settings,
  Task,
  Transaction,
} from "./types";

/**
 * Every data endpoint of /api, written once. The Next route files hand their
 * requests here (api-next.ts), and the desktop app calls `dispatch` directly
 * with no server in between (local-api.ts) — the same checks and the same
 * answers in both.
 */

export interface ApiResult {
  status: number;
  body: unknown;
}

type Params = Record<string, string>;
type Handler = (params: Params, body: unknown) => Promise<ApiResult>;

const ok = (body: unknown): ApiResult => ({ status: 200, body });
const notFound = (): ApiResult => ({ status: 404, body: { error: "לא נמצא" } });
const badRequest = (message: string): ApiResult => ({
  status: 400,
  body: { error: message },
});
const NOT_JSON = "גוף הבקשה אינו JSON תקין";

async function handle(fn: () => Promise<unknown>): Promise<ApiResult> {
  try {
    return ok(await fn());
  } catch (error) {
    console.error("API error:", error);
    return { status: 500, body: { error: "הפעולה נכשלה בצד השרת" } };
  }
}

const found = (value: unknown) => (value ? ok(value) : notFound());
const done = async (work: Promise<unknown>) => {
  await work;
  return { ok: true };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string");

const LINK_KINDS = ["task", "event", "transaction", "note", "list"];

/** "METHOD /api/path/:param" → handler. */
const ROUTES: Record<string, Handler> = {
  /* The whole database in one call — used on app load, on JSON import, on
   * the one-time migration from localStorage, and on wipe. Loading is also
   * when today's copies of routines are made. */
  "GET /api/data": () =>
    handle(async () => {
      await repo.ensureRoutineCopies();
      return repo.readAll();
    }),
  "PUT /api/data": (_, body) => {
    const snapshot = body as Partial<DataSnapshot> | null;
    if (!snapshot || !Array.isArray(snapshot.tasks)) {
      return Promise.resolve(badRequest("קובץ לא תקין"));
    }
    return handle(() => repo.replaceAll(snapshot));
  },
  "DELETE /api/data": () => handle(() => repo.clearAll()),
  /* First run: { today } adds the sample set; DELETE takes it away again. */
  "POST /api/sample": (_, body) => {
    const today = (body as { today?: unknown } | null)?.today;
    if (typeof today !== "string" || !/^d{4}-d{2}-d{2}$/.test(today)) {
      return Promise.resolve(badRequest("תאריך לא תקין"));
    }
    return handle(() => repo.addSampleData(today));
  },
  "DELETE /api/sample": () => handle(() => repo.removeSampleData()),

  /* ---------------------------------------------------------- tasks */
  "GET /api/tasks": () => handle(() => repo.listTasks()),
  "POST /api/tasks": async (_, body) =>
    body ? handle(() => repo.createTask(body as Partial<Task>)) : badRequest(NOT_JSON),
  "GET /api/tasks/:id": async ({ id }) => found(await repo.getTask(id)),
  "PATCH /api/tasks/:id": async ({ id }, body) =>
    body ? found(await repo.updateTask(id, body as Partial<Task>)) : badRequest(NOT_JSON),
  "DELETE /api/tasks/:id": ({ id }) => handle(() => done(repo.deleteTask(id))),
  /* Body: { ids } — the tasks of one day, in the order they should appear. */
  "POST /api/tasks/reorder": async (_, body) => {
    const ids = isObject(body) ? body.ids : undefined;
    if (!isIdList(ids)) return badRequest("צריך רשימת מזהים");
    return handle(() => done(repo.reorderTasks(ids)));
  },

  /* ------------------------------------------------------- routines */
  "GET /api/routines": () => handle(() => repo.listRoutines()),
  /* Creates the routine and, if it falls today, today's copy with it. */
  "POST /api/routines": async (_, body) => {
    const input = body as Partial<Routine> | null;
    if (!input?.title || !input.repeat) {
      return badRequest("חסרים כותרת או תדירות");
    }
    // Which day was last copied is the server's to decide; a client that
    // sends it along would stop today's copy from being made.
    const fields = { ...input, lastDate: undefined };
    return handle(async () => {
      const routine = await repo.createRoutine(fields);
      await repo.ensureRoutineCopies();
      return routine;
    });
  },
  "PATCH /api/routines/:id": async ({ id }, body) =>
    body
      ? found(await repo.updateRoutine(id, body as Partial<Routine>))
      : badRequest(NOT_JSON),
  "DELETE /api/routines/:id": ({ id }) =>
    handle(() => done(repo.deleteRoutine(id))),

  /* --------------------------------------------------------- events */
  "GET /api/events": () => handle(() => repo.listEvents()),
  "POST /api/events": async (_, body) =>
    body
      ? handle(() => repo.createEvent(body as Partial<CalendarEvent>))
      : badRequest(NOT_JSON),
  "GET /api/events/:id": async ({ id }) => found(await repo.getEvent(id)),
  "PATCH /api/events/:id": async ({ id }, body) =>
    body
      ? found(await repo.updateEvent(id, body as Partial<CalendarEvent>))
      : badRequest(NOT_JSON),
  "DELETE /api/events/:id": ({ id }) => handle(() => done(repo.deleteEvent(id))),

  /* --------------------------------------------------- transactions */
  "GET /api/transactions": () => handle(() => repo.listTransactions()),
  "POST /api/transactions": async (_, body) =>
    body
      ? handle(() => repo.createTransaction(body as Partial<Transaction>))
      : badRequest(NOT_JSON),
  "GET /api/transactions/:id": async ({ id }) =>
    found(await repo.getTransaction(id)),
  "PATCH /api/transactions/:id": async ({ id }, body) =>
    body
      ? found(await repo.updateTransaction(id, body as Partial<Transaction>))
      : badRequest(NOT_JSON),
  "DELETE /api/transactions/:id": ({ id }) =>
    handle(() => done(repo.deleteTransaction(id))),
  /* Body: { transactions } — all saved together, or none. */
  "POST /api/transactions/bulk": async (_, body) => {
    const rows = isObject(body) ? body.transactions : undefined;
    if (!Array.isArray(rows)) return badRequest("צריך רשימת תנועות");
    return handle(() =>
      repo.createTransactions(rows as Partial<Transaction>[]),
    );
  },
  /* Body: { ids } — undoing an import. */
  "DELETE /api/transactions/bulk": async (_, body) => {
    const ids = isObject(body) ? body.ids : undefined;
    if (!isIdList(ids)) return badRequest("צריך רשימת מזהים");
    return handle(() => done(repo.deleteTransactions(ids)));
  },

  /* ---------------------------------------------------------- notes */
  "GET /api/notes": () => handle(() => repo.listNotes()),
  "POST /api/notes": async (_, body) =>
    body ? handle(() => repo.createNote(body as Partial<Note>)) : badRequest(NOT_JSON),
  "GET /api/notes/:id": async ({ id }) => found(await repo.getNote(id)),
  "PATCH /api/notes/:id": async ({ id }, body) =>
    body ? found(await repo.updateNote(id, body as Partial<Note>)) : badRequest(NOT_JSON),
  "DELETE /api/notes/:id": ({ id }) => handle(() => done(repo.deleteNote(id))),

  /* ----------------------------------------------------- checklists */
  "GET /api/checklists": () => handle(() => repo.listChecklists()),
  "POST /api/checklists": async (_, body) => {
    const input = body as {
      id?: string;
      title?: string;
      items?: (string | { id?: string; text: string })[];
    } | null;
    const title = input?.title?.trim();
    if (!title) return badRequest("צריך שם לרשימה");
    return handle(() =>
      repo.createChecklist(title, input?.items ?? [], input?.id),
    );
  },
  "PATCH /api/checklists/:id": async ({ id }, body) => {
    const input = body as {
      title?: string;
      addItem?: string;
      addItemId?: string;
      addItemIndex?: number | null;
      addItemDone?: boolean | null;
      clearDone?: boolean;
      resetDone?: boolean;
      pinned?: boolean;
      order?: string[];
    } | null;
    if (!input) return badRequest(NOT_JSON);

    let list = null;
    if (input.title?.trim()) list = await repo.renameChecklist(id, input.title.trim());
    if (input.addItem?.trim()) {
      list = await repo.addChecklistItem(id, input.addItem.trim(), input.addItemId, {
        index: input.addItemIndex ?? undefined,
        done: input.addItemDone ?? undefined,
      });
    }
    if (input.clearDone) list = await repo.clearDoneChecklistItems(id);
    if (input.resetDone) list = await repo.resetChecklist(id);
    if (typeof input.pinned === "boolean") {
      list = await repo.setChecklistPinned(id, input.pinned);
    }
    if (Array.isArray(input.order)) {
      list = await repo.reorderChecklistItems(id, input.order);
    }
    return found(list);
  },
  "DELETE /api/checklists/:id": ({ id }) =>
    handle(() => done(repo.deleteChecklist(id))),
  "PATCH /api/checklists/:id/items/:itemId": async ({ id, itemId }, body) =>
    body
      ? found(
          await repo.setChecklistItem(
            id,
            itemId,
            body as { text?: string; done?: boolean },
          ),
        )
      : badRequest(NOT_JSON),
  "DELETE /api/checklists/:id/items/:itemId": async ({ id, itemId }) =>
    found(await repo.deleteChecklistItem(id, itemId)),

  /* ----------------------------------------------------- categories */
  "GET /api/categories": () => handle(() => repo.listCategories()),
  "POST /api/categories": async (_, body) => {
    const input = body as (Omit<Category, "id"> & { id?: string }) | null;
    if (!input?.name || !input.kind) return badRequest("חסר שם או סוג");
    return handle(() => repo.createCategory(input));
  },
  "PATCH /api/categories/:id": async ({ id }, body) =>
    body
      ? found(await repo.updateCategory(id, body as Partial<Category>))
      : badRequest(NOT_JSON),
  "DELETE /api/categories/:id": ({ id }) =>
    handle(() => done(repo.deleteCategory(id))),

  /* ---------------------------------------------------------- links */
  "GET /api/links": () => handle(() => repo.listLinks()),
  "POST /api/links": async (_, body) => {
    const link = body as Partial<Link> | null;
    if (
      !link?.aId ||
      !link.bId ||
      link.aId === link.bId ||
      !LINK_KINDS.includes(link.aKind ?? "") ||
      !LINK_KINDS.includes(link.bKind ?? "")
    ) {
      return badRequest("קישור לא תקין");
    }
    return handle(() => repo.createLink(link));
  },
  "DELETE /api/links/:id": ({ id }) => handle(() => done(repo.deleteLink(id))),

  /* ------------------------------------------------------- settings */
  /* Body: { calendars } — colour and visibility per Google calendar, merged
   * in; { budgets } — every monthly budget, replacing the old set; and/or
   * { prefs } — preferences, merged in (null clears one). */
  "PATCH /api/settings": async (_, body) => {
    const { calendars, budgets, prefs } = (body ?? {}) as Partial<Settings>;
    if (!isObject(calendars) && !isObject(budgets) && !isObject(prefs)) {
      return badRequest("אין מה לעדכן");
    }
    return handle(async () => ({
      calendars: calendars
        ? await repo.setCalendarPrefs({
            ...(await repo.getCalendarPrefs()),
            ...calendars,
          })
        : await repo.getCalendarPrefs(),
      ...(budgets ? { budgets: await repo.setBudgets(budgets) } : {}),
      ...(prefs ? { prefs: await repo.setPrefs({ ...prefs }) } : {}),
    }));
  },
};

/** Match "/api/tasks/abc" against "/api/tasks/:id". */
function match(pattern: string, path: string): Params | null {
  const want = pattern.split("/");
  const got = path.split("/");
  if (want.length !== got.length) return null;
  const params: Params = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":")) params[want[i].slice(1)] = decodeURIComponent(got[i]);
    else if (want[i] !== got[i]) return null;
  }
  return params;
}

/** Runs one known route. `pattern` is the route's own address. */
export function runRoute(
  method: string,
  pattern: string,
  params: Params,
  body: unknown,
): Promise<ApiResult> {
  const handler = ROUTES[`${method} ${pattern}`];
  if (!handler) {
    return Promise.resolve({ status: 405, body: { error: "פעולה לא נתמכת" } });
  }
  return handler(params, body);
}

/** Finds the route for a real address — the desktop app's way in. */
export function dispatch(
  method: string,
  url: string,
  body: unknown,
): Promise<ApiResult> {
  const path = url.replace(/[?#].*$/, "").replace(/\/$/, "");
  for (const key of Object.keys(ROUTES)) {
    const space = key.indexOf(" ");
    if (key.slice(0, space) !== method) continue;
    const params = match(key.slice(space + 1), path);
    if (params) return runRoute(method, key.slice(space + 1), params, body);
  }
  return Promise.resolve(notFound());
}
