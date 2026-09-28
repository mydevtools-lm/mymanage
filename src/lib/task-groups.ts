import { addDays, parseISO } from "date-fns";
import { toDateKey } from "./format";
import type { Priority, Task } from "./types";

export type WhenGroup =
  "overdue" | "today" | "tomorrow" | "week" | "later" | "undated";

export const GROUP_LABELS: Record<WhenGroup, string> = {
  overdue: "באיחור",
  today: "היום",
  tomorrow: "מחר",
  week: "בשבוע הקרוב",
  later: "בהמשך",
  undated: "בלי תאריך",
};

const ORDER: WhenGroup[] = [
  "overdue",
  "today",
  "tomorrow",
  "week",
  "later",
  "undated",
];

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function whenOf(task: Task, today: string): WhenGroup {
  const due = task.dueDate;
  if (!due) return "undated";
  if (due < today) return "overdue";
  if (due === today) return "today";
  const base = parseISO(today);
  if (due === toDateKey(addDays(base, 1))) return "tomorrow";
  // "This week" means the next seven days, not the calendar week — on a
  // Friday the calendar week would hold a single day.
  if (due <= toDateKey(addDays(base, 7))) return "week";
  return "later";
}

function compare(a: Task, b: Task) {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  if ((a.dueTime ?? "") !== (b.dueTime ?? "")) {
    // Timed tasks first within a day, in time order.
    if (!a.dueTime) return 1;
    if (!b.dueTime) return -1;
    return a.dueTime.localeCompare(b.dueTime);
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

/** Active tasks split into time buckets, empty buckets dropped. */
export function groupTasksByWhen(tasks: Task[], today: string) {
  const buckets = new Map<WhenGroup, Task[]>();
  for (const task of tasks) {
    const group = whenOf(task, today);
    const list = buckets.get(group) ?? [];
    list.push(task);
    buckets.set(group, list);
  }
  return ORDER.filter((g) => buckets.has(g)).map((group) => ({
    group,
    label: GROUP_LABELS[group],
    tasks: buckets.get(group)!.sort(compare),
  }));
}
