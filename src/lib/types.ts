export type Priority = "low" | "normal" | "high" | "urgent";
export type CategoryKind = "task" | "finance";
export type TransactionType = "income" | "expense";

export type ColorKey =
  "teal" | "coral" | "lavender" | "amber" | "sky" | "mint" | "rose" | "slate";

export interface Category {
  id: string;
  name: string;
  color: ColorKey;
  kind: CategoryKind;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string; // yyyy-MM-dd
  dueTime?: string; // HH:mm, only meaningful with a dueDate
  priority: Priority;
  categoryId?: string;
  completed: boolean;
  completedAt?: string;
  /** Set when a finished task is moved out of the active list. */
  archivedAt?: string;
  /** The routine this task is one day's copy of. */
  routineId?: string;
  subtasks?: Subtask[];
  /** Hand-picked order among the tasks of one day; lower comes first. */
  position?: number;
  /** Minutes before dueTime to remind; unset means no reminder. */
  reminder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

/** How often a routine comes back. Days of the week are 0 (Sunday)–6. */
export type Repeat =
  | { kind: "daily" }
  | { kind: "weekly"; days: number[] }
  | { kind: "monthly"; day: number }
  /** Same day and month as the start date — birthdays, anniversaries. */
  | { kind: "yearly" };

/**
 * A task that comes back by itself — pills, workout, mail. Each day it is
 * due, a plain task is created from it, and ticking that one archives only
 * that day's copy.
 */
export interface Routine {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  categoryId?: string;
  dueTime?: string;
  repeat: Repeat;
  startDate: string; // yyyy-MM-dd
  /** The last day a copy was made for. */
  lastDate?: string;
  paused?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  startTime?: string; // HH:mm
  endTime?: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  color: ColorKey;
  /** Minutes before startTime to remind; unset means no reminder. */
  reminder?: number;
  /** Comes back from `date` on, until `until` (inclusive) if set. */
  repeat?: Repeat;
  until?: string;
  /** Per-day changes to a recurring event: skip a day, or change it. */
  exceptions?: EventException[];
  /** Set on an occurrence of a recurring event, as shown on screen: the
   *  stored event it comes from, and the day it originally fell on. */
  seriesId?: string;
  occurrenceDate?: string;
  createdAt: string;
}

export interface EventException {
  date: string; // the day the occurrence originally falls on
  skip?: boolean;
  /** Moved to another day. */
  newDate?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  notes?: string;
  color?: ColorKey;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string; // yyyy-MM-dd
  categoryId?: string;
  notes?: string;
  recurring?: {
    startMonth: string; // yyyy-MM
    endMonth?: string; // yyyy-MM (inclusive)
  };
  /** Per-month changes to a recurring series: skip a month, or override it. */
  exceptions?: TransactionException[];
  createdAt: string;
}

export interface TransactionException {
  month: string; // yyyy-MM
  skip?: boolean;
  amount?: number;
  description?: string;
  categoryId?: string;
}

/** How far an edit or delete on one month of a recurring series reaches. */
export type SeriesScope = "this" | "following" | "all";

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned?: boolean;
  color?: ColorKey;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** A tickable list — shopping, packing, anything repeatable. */
export interface Checklist {
  id: string;
  title: string;
  pinned?: boolean;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export type LinkKind = "task" | "event" | "transaction" | "note" | "list";

/** Two items that belong together. Either end can be read as the start. */
export interface Link {
  id: string;
  aKind: LinkKind;
  aId: string;
  bKind: LinkKind;
  bId: string;
  createdAt: string;
}

export interface Settings {
  startMonth: string; // yyyy-MM
  /** Per Google calendar (by its number in .env.local): colour, hidden. */
  calendars?: Record<string, CalendarPref>;
  /** Monthly budget per expense category id, in shekels. */
  budgets?: Record<string, number>;
}

export interface CalendarPref {
  color?: ColorKey;
  hidden?: boolean;
}

export interface DataSnapshot {
  version: 1;
  exportedAt: string;
  tasks: Task[];
  events: CalendarEvent[];
  transactions: Transaction[];
  notes: Note[];
  checklists: Checklist[];
  routines?: Routine[];
  links?: Link[];
  categories: Category[];
  settings: Settings;
}
