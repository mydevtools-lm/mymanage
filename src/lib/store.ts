"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CalendarEvent,
  Category,
  DataSnapshot,
  Note,
  Settings,
  Task,
  Transaction,
} from "./types";
import { newId, toMonthKey } from "./format";

const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "עבודה", color: "teal", kind: "task" },
  { name: "בית", color: "amber", kind: "task" },
  { name: "אישי", color: "lavender", kind: "task" },
  { name: "לימודים", color: "sky", kind: "task" },
  { name: "משכורת", color: "mint", kind: "finance" },
  { name: "הכנסה נוספת", color: "teal", kind: "finance" },
  { name: "שכירות / משכנתא", color: "coral", kind: "finance" },
  { name: "אוכל", color: "amber", kind: "finance" },
  { name: "תחבורה", color: "sky", kind: "finance" },
  { name: "חשבונות", color: "rose", kind: "finance" },
  { name: "בילויים", color: "lavender", kind: "finance" },
  { name: "אחר", color: "slate", kind: "finance" },
];

type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt" | "completed">;
type EventInput = Omit<CalendarEvent, "id" | "createdAt">;
type TransactionInput = Omit<Transaction, "id" | "createdAt">;
type NoteInput = Pick<Note, "title" | "body">;
type CategoryInput = Omit<Category, "id">;

interface AppState {
  hydrated: boolean;
  tasks: Task[];
  events: CalendarEvent[];
  transactions: Transaction[];
  notes: Note[];
  categories: Category[];
  settings: Settings;

  addTask: (input: TaskInput) => void;
  updateTask: (id: string, input: Partial<TaskInput>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  addEvent: (input: EventInput) => void;
  updateEvent: (id: string, input: Partial<EventInput>) => void;
  deleteEvent: (id: string) => void;

  addTransaction: (input: TransactionInput) => void;
  updateTransaction: (id: string, input: Partial<TransactionInput>) => void;
  deleteTransaction: (id: string) => void;

  addNote: (input: NoteInput) => void;
  updateNote: (id: string, input: Partial<NoteInput>) => void;
  deleteNote: (id: string) => void;

  addCategory: (input: CategoryInput) => void;
  updateCategory: (id: string, input: Partial<CategoryInput>) => void;
  deleteCategory: (id: string) => void;

  exportData: () => DataSnapshot;
  importData: (snapshot: DataSnapshot) => void;
  clearAll: () => void;
}

const now = () => new Date().toISOString();

function seedCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, id: newId() }));
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      tasks: [],
      events: [],
      transactions: [],
      notes: [],
      categories: [],
      settings: { startMonth: toMonthKey(new Date()) },

      addTask: (input) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              ...input,
              id: newId(),
              completed: false,
              createdAt: now(),
              updatedAt: now(),
            },
          ],
        })),
      updateTask: (id, input) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...input, updatedAt: now() } : t,
          ),
        })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed: !t.completed,
                  completedAt: t.completed ? undefined : now(),
                  updatedAt: now(),
                }
              : t,
          ),
        })),
      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addEvent: (input) =>
        set((s) => ({
          events: [...s.events, { ...input, id: newId(), createdAt: now() }],
        })),
      updateEvent: (id, input) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...input } : e)),
        })),
      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      addTransaction: (input) =>
        set((s) => ({
          transactions: [
            ...s.transactions,
            { ...input, id: newId(), createdAt: now() },
          ],
        })),
      updateTransaction: (id, input) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, ...input } : t,
          ),
        })),
      deleteTransaction: (id) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => t.id !== id),
        })),

      addNote: (input) =>
        set((s) => ({
          notes: [
            { ...input, id: newId(), createdAt: now(), updatedAt: now() },
            ...s.notes,
          ],
        })),
      updateNote: (id, input) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...input, updatedAt: now() } : n,
          ),
        })),
      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addCategory: (input) =>
        set((s) => ({
          categories: [...s.categories, { ...input, id: newId() }],
        })),
      updateCategory: (id, input) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, ...input } : c,
          ),
        })),
      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          tasks: s.tasks.map((t) =>
            t.categoryId === id ? { ...t, categoryId: undefined } : t,
          ),
          transactions: s.transactions.map((t) =>
            t.categoryId === id ? { ...t, categoryId: undefined } : t,
          ),
        })),

      exportData: () => {
        const s = get();
        return {
          version: 1,
          exportedAt: now(),
          tasks: s.tasks,
          events: s.events,
          transactions: s.transactions,
          notes: s.notes,
          categories: s.categories,
          settings: s.settings,
        };
      },
      importData: (snapshot) =>
        set({
          tasks: snapshot.tasks ?? [],
          events: snapshot.events ?? [],
          transactions: snapshot.transactions ?? [],
          notes: snapshot.notes ?? [],
          categories: snapshot.categories ?? seedCategories(),
          settings: snapshot.settings ?? { startMonth: toMonthKey(new Date()) },
        }),
      clearAll: () =>
        set({
          tasks: [],
          events: [],
          transactions: [],
          notes: [],
          categories: seedCategories(),
          settings: { startMonth: toMonthKey(new Date()) },
        }),
    }),
    {
      name: "lior-management",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        tasks: s.tasks,
        events: s.events,
        transactions: s.transactions,
        notes: s.notes,
        categories: s.categories,
        settings: s.settings,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // First run: seed default categories so the dialogs are not empty.
        if (state.categories.length === 0) {
          useAppStore.setState({ categories: seedCategories() });
        }
        useAppStore.setState({ hydrated: true });
      },
    },
  ),
);

export function useCategories(kind: Category["kind"]) {
  return useAppStore((s) => s.categories).filter((c) => c.kind === kind);
}
