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
  createdAt: string;
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

export interface Settings {
  startMonth: string; // yyyy-MM
}

export interface DataSnapshot {
  version: 1;
  exportedAt: string;
  tasks: Task[];
  events: CalendarEvent[];
  transactions: Transaction[];
  notes: Note[];
  checklists: Checklist[];
  categories: Category[];
  settings: Settings;
}
