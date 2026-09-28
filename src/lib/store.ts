"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type {
  CalendarEvent,
  Category,
  Checklist,
  DataSnapshot,
  Note,
  SeriesScope,
  Settings,
  Task,
  Transaction,
} from "./types";
import { toMonthKey } from "./format";
import { toJsonBody } from "./json-body";
import { planSeriesDelete, planSeriesEdit, type SeriesPlan } from "./finance";

/**
 * Client-side mirror of the SQLite database.
 *
 * Every screen reads from here synchronously, exactly as it did when the data
 * lived in localStorage. Writes apply to the mirror first so the UI never
 * waits on a round trip, then go to the API; if the server rejects one, the
 * mirror is refetched so the screen can't drift from the file on disk.
 *
 * Ids are generated here, not on the server. A row is therefore addressable
 * the moment it appears on screen — ticking a task a split second after
 * creating it no longer races the server's reply.
 */

const LEGACY_KEY = "lior-management";

type TaskInput = Omit<
  Task,
  "id" | "createdAt" | "updatedAt" | "completed" | "archivedAt"
>;
type EventInput = Omit<CalendarEvent, "id" | "createdAt">;
type TransactionInput = Omit<Transaction, "id" | "createdAt">;
type NoteInput = Pick<Note, "title" | "body">;
type CategoryInput = Omit<Category, "id">;

interface AppState {
  hydrated: boolean;
  syncing: boolean;
  tasks: Task[];
  events: CalendarEvent[];
  transactions: Transaction[];
  notes: Note[];
  checklists: Checklist[];
  categories: Category[];
  settings: Settings;

  load: () => Promise<void>;

  addTask: (input: TaskInput) => void;
  updateTask: (id: string, input: Partial<TaskInput>) => void;
  toggleTask: (id: string) => void;
  archiveTask: (id: string) => void;
  restoreTask: (id: string) => void;
  deleteTask: (id: string) => void;

  addEvent: (input: EventInput) => void;
  updateEvent: (id: string, input: Partial<EventInput>) => void;
  deleteEvent: (id: string) => void;

  addTransaction: (input: TransactionInput) => void;
  updateTransaction: (id: string, input: Partial<TransactionInput>) => void;
  deleteTransaction: (id: string) => void;
  /** Delete one month, this month onwards, or the whole recurring series. */
  deleteTransactionInSeries: (
    id: string,
    month: string,
    scope: SeriesScope,
  ) => void;
  /** Edit one month, this month onwards, or the whole recurring series. */
  editTransactionInSeries: (
    id: string,
    month: string,
    scope: SeriesScope,
    fields: Partial<TransactionInput>,
  ) => void;

  addNote: (input: NoteInput) => void;
  updateNote: (id: string, input: Partial<NoteInput>) => void;
  deleteNote: (id: string) => void;

  addChecklist: (title: string, items?: string[]) => void;
  renameChecklist: (id: string, title: string) => void;
  deleteChecklist: (id: string) => void;
  addChecklistItem: (listId: string, text: string) => void;
  toggleChecklistItem: (listId: string, itemId: string) => void;
  deleteChecklistItem: (listId: string, itemId: string) => void;
  clearDoneItems: (listId: string) => void;

  addCategory: (input: CategoryInput) => void;
  updateCategory: (id: string, input: Partial<CategoryInput>) => void;
  deleteCategory: (id: string) => void;

  exportData: () => DataSnapshot;
  importData: (snapshot: DataSnapshot) => Promise<void>;
  clearAll: () => Promise<void>;
}

const now = () => new Date().toISOString();

async function api(
  url: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? toJsonBody(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? `שגיאת שרת (${response.status})`);
  }
  return response.json();
}

// Fire a write and keep the mirror honest if it fails.
function push(work: Promise<unknown>) {
  work.catch((error: Error) => {
    toast.error(error.message || "השמירה נכשלה");
    void useAppStore.getState().load();
  });
}

function applySnapshot(snapshot: DataSnapshot) {
  useAppStore.setState({
    tasks: snapshot.tasks ?? [],
    events: snapshot.events ?? [],
    transactions: snapshot.transactions ?? [],
    notes: snapshot.notes ?? [],
    checklists: snapshot.checklists ?? [],
    categories: snapshot.categories ?? [],
    settings: snapshot.settings ?? { startMonth: toMonthKey(new Date()) },
    hydrated: true,
  });
}

/**
 * Data written by earlier versions lived in localStorage. Move it into the
 * database once, the first time this browser meets an empty database, then
 * keep the old copy under a renamed key as a safety net.
 */
async function migrateLegacyData(current: DataSnapshot) {
  if (typeof localStorage === "undefined") return current;

  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return current;

  const alreadyHasData =
    current.tasks.length > 0 ||
    current.events.length > 0 ||
    current.transactions.length > 0 ||
    current.notes.length > 0 ||
    current.checklists.length > 0;
  if (alreadyHasData) return current;

  try {
    const parsed = JSON.parse(raw);
    const legacy: Partial<DataSnapshot> = parsed?.state ?? parsed;
    const count =
      (legacy.tasks?.length ?? 0) +
      (legacy.events?.length ?? 0) +
      (legacy.transactions?.length ?? 0) +
      (legacy.notes?.length ?? 0);
    if (count === 0) return current;

    const migrated = (await api("/api/data", "PUT", {
      ...legacy,
      tasks: legacy.tasks ?? [],
    })) as DataSnapshot;

    localStorage.setItem(`${LEGACY_KEY}-migrated`, raw);
    localStorage.removeItem(LEGACY_KEY);
    toast.success(`${count} פריטים הועברו מהדפדפן למסד הנתונים`);
    return migrated;
  } catch (error) {
    console.error("legacy migration failed", error);
    return current;
  }
}

export const useAppStore = create<AppState>()((set, get) => ({
  hydrated: false,
  syncing: false,
  tasks: [],
  events: [],
  transactions: [],
  notes: [],
  checklists: [],
  categories: [],
  settings: { startMonth: toMonthKey(new Date()) },

  load: async () => {
    set({ syncing: true });
    try {
      let snapshot = (await api("/api/data", "GET")) as DataSnapshot;
      snapshot = await migrateLegacyData(snapshot);
      applySnapshot(snapshot);
    } catch (error) {
      console.error(error);
      toast.error("לא הצלחנו לטעון את הנתונים מהשרת");
      set({ hydrated: true });
    } finally {
      set({ syncing: false });
    }
  },

  /* ---------------------------------------------------------- tasks */

  addTask: (input) => {
    const row: Task = {
      ...input,
      id: crypto.randomUUID(),
      completed: false,
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({ tasks: [...s.tasks, row] }));
    push(api("/api/tasks", "POST", row));
  },
  updateTask: (id, input) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, ...input, updatedAt: now() } : t,
      ),
    }));
    push(api(`/api/tasks/${id}`, "PATCH", input));
  },
  toggleTask: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const patch = task.completed
      ? { completed: false, completedAt: undefined, archivedAt: undefined }
      : { completed: true, completedAt: now(), archivedAt: now() };
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: now() } : t,
      ),
    }));
    push(api(`/api/tasks/${id}`, "PATCH", patch));
  },
  archiveTask: (id) => {
    const patch = { archivedAt: now() };
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    push(api(`/api/tasks/${id}`, "PATCH", patch));
  },
  restoreTask: (id) => {
    const patch = {
      archivedAt: undefined,
      completed: false,
      completedAt: undefined,
    };
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    push(api(`/api/tasks/${id}`, "PATCH", patch));
  },
  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    push(api(`/api/tasks/${id}`, "DELETE"));
  },

  /* --------------------------------------------------------- events */

  addEvent: (input) => {
    const row: CalendarEvent = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now(),
    };
    set((s) => ({ events: [...s.events, row] }));
    push(api("/api/events", "POST", row));
  },
  updateEvent: (id, input) => {
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...input } : e)),
    }));
    push(api(`/api/events/${id}`, "PATCH", input));
  },
  deleteEvent: (id) => {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    push(api(`/api/events/${id}`, "DELETE"));
  },

  /* --------------------------------------------------- transactions */

  addTransaction: (input) => {
    const row: Transaction = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now(),
    };
    set((s) => ({ transactions: [...s.transactions, row] }));
    push(api("/api/transactions", "POST", row));
  },
  updateTransaction: (id, input) => {
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === id ? { ...t, ...input } : t,
      ),
    }));
    push(api(`/api/transactions/${id}`, "PATCH", input));
  },
  deleteTransaction: (id) => {
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
    push(api(`/api/transactions/${id}`, "DELETE"));
  },
  deleteTransactionInSeries: (id, month, scope) => {
    const t = get().transactions.find((x) => x.id === id);
    if (t) applySeriesPlan(planSeriesDelete(t, month, scope));
  },
  editTransactionInSeries: (id, month, scope, fields) => {
    const t = get().transactions.find((x) => x.id === id);
    if (t) applySeriesPlan(planSeriesEdit(t, month, scope, fields));
  },

  /* ---------------------------------------------------------- notes */

  addNote: (input) => {
    const row: Note = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({ notes: [row, ...s.notes] }));
    push(api("/api/notes", "POST", row));
  },
  updateNote: (id, input) => {
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...input, updatedAt: now() } : n,
      ),
    }));
    push(api(`/api/notes/${id}`, "PATCH", input));
  },
  deleteNote: (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    push(api(`/api/notes/${id}`, "DELETE"));
  },

  /* ----------------------------------------------------- checklists */

  addChecklist: (title, items = []) => {
    const list: Checklist = {
      id: crypto.randomUUID(),
      title,
      items: items.map((text) => ({
        id: crypto.randomUUID(),
        text,
        done: false,
      })),
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({ checklists: [list, ...s.checklists] }));
    push(
      api("/api/checklists", "POST", {
        id: list.id,
        title,
        items: list.items.map(({ id, text }) => ({ id, text })),
      }),
    );
  },
  renameChecklist: (id, title) => {
    set((s) => ({
      checklists: s.checklists.map((l) => (l.id === id ? { ...l, title } : l)),
    }));
    push(api(`/api/checklists/${id}`, "PATCH", { title }));
  },
  deleteChecklist: (id) => {
    set((s) => ({ checklists: s.checklists.filter((l) => l.id !== id) }));
    push(api(`/api/checklists/${id}`, "DELETE"));
  },
  addChecklistItem: (listId, text) => {
    const item = { id: crypto.randomUUID(), text, done: false };
    set((s) => ({
      checklists: s.checklists.map((l) =>
        l.id === listId ? { ...l, items: [...l.items, item] } : l,
      ),
    }));
    push(
      api(`/api/checklists/${listId}`, "PATCH", {
        addItem: text,
        addItemId: item.id,
      }),
    );
  },
  toggleChecklistItem: (listId, itemId) => {
    const list = get().checklists.find((l) => l.id === listId);
    const item = list?.items.find((i) => i.id === itemId);
    if (!item) return;
    const done = !item.done;
    set((s) => ({
      checklists: s.checklists.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: l.items.map((i) => (i.id === itemId ? { ...i, done } : i)),
            }
          : l,
      ),
    }));
    push(api(`/api/checklists/${listId}/items/${itemId}`, "PATCH", { done }));
  },
  deleteChecklistItem: (listId, itemId) => {
    set((s) => ({
      checklists: s.checklists.map((l) =>
        l.id === listId
          ? { ...l, items: l.items.filter((i) => i.id !== itemId) }
          : l,
      ),
    }));
    push(api(`/api/checklists/${listId}/items/${itemId}`, "DELETE"));
  },
  clearDoneItems: (listId) => {
    set((s) => ({
      checklists: s.checklists.map((l) =>
        l.id === listId ? { ...l, items: l.items.filter((i) => !i.done) } : l,
      ),
    }));
    push(api(`/api/checklists/${listId}`, "PATCH", { clearDone: true }));
  },

  /* ----------------------------------------------------- categories */

  addCategory: (input) => {
    const category: Category = { ...input, id: crypto.randomUUID() };
    set((s) => ({ categories: [...s.categories, category] }));
    push(api("/api/categories", "POST", category));
  },
  updateCategory: (id, input) => {
    set((s) => ({
      categories: s.categories.map((c) =>
        c.id === id ? { ...c, ...input } : c,
      ),
    }));
    push(api(`/api/categories/${id}`, "PATCH", input));
  },
  deleteCategory: (id) => {
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      tasks: s.tasks.map((t) =>
        t.categoryId === id ? { ...t, categoryId: undefined } : t,
      ),
      transactions: s.transactions.map((t) =>
        t.categoryId === id ? { ...t, categoryId: undefined } : t,
      ),
    }));
    push(api(`/api/categories/${id}`, "DELETE"));
  },

  /* ------------------------------------------------ whole snapshot */

  exportData: () => {
    const s = get();
    return {
      version: 1,
      exportedAt: now(),
      tasks: s.tasks,
      events: s.events,
      transactions: s.transactions,
      notes: s.notes,
      checklists: s.checklists,
      categories: s.categories,
      settings: s.settings,
    };
  },
  importData: async (snapshot) => {
    const saved = (await api("/api/data", "PUT", snapshot)) as DataSnapshot;
    applySnapshot(saved);
  },
  clearAll: async () => {
    const saved = (await api("/api/data", "DELETE")) as DataSnapshot;
    applySnapshot(saved);
  },
}));

/** Carry out a plan from planSeriesDelete / planSeriesEdit. */
function applySeriesPlan(plan: SeriesPlan) {
  const set = useAppStore.setState;

  if (plan.kind === "delete") {
    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== plan.id),
    }));
    push(api(`/api/transactions/${plan.id}`, "DELETE"));
    return;
  }

  set((s) => ({
    transactions: s.transactions.map((t) =>
      t.id === plan.id ? { ...t, ...plan.patch } : t,
    ),
  }));
  push(api(`/api/transactions/${plan.id}`, "PATCH", plan.patch));

  if (plan.kind === "split") {
    const created: Transaction = {
      ...plan.create,
      id: crypto.randomUUID(),
      createdAt: now(),
    };
    set((s) => ({ transactions: [...s.transactions, created] }));
    push(api("/api/transactions", "POST", created));
  }
}

export function useCategories(kind: Category["kind"]) {
  return useAppStore((s) => s.categories).filter((c) => c.kind === kind);
}
