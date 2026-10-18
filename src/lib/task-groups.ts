import { addDays, format, parseISO } from "date-fns";
import { toDateKey } from "./format";
import { dateLocale, t } from "./i18n";
import type { Priority, Task } from "./types";

export type WhenGroup =
  "overdue" | "today" | "tomorrow" | "week" | "later" | "undated";

export function groupLabels(): Record<WhenGroup, string> {
  const { common, tasks } = t();
  return {
    overdue: tasks.groups.overdue,
    today: common.today,
    tomorrow: common.tomorrow,
    week: tasks.groups.week,
    later: tasks.groups.later,
    undated: common.noDate,
  };
}

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

/** Tasks placed by hand, in their order, before those that never were. */
export function byPosition(a: Task, b: Task) {
  return (a.position ?? Infinity) - (b.position ?? Infinity) || 0;
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
  // A hand-picked order wins; tasks never placed by hand follow it.
  const byHand = byPosition(a, b);
  if (byHand) return byHand;
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
  const labels = groupLabels();
  return ORDER.filter((g) => buckets.has(g)).map((group) => ({
    group,
    label: labels[group],
    tasks: buckets.get(group)!.sort(compare),
  }));
}

/** A day a task can be dropped on, on the tasks screen. */
export interface DayTarget {
  key: string;
  label: string;
  /** yyyy-MM-dd, or undefined for "no date". */
  date: string | undefined;
}

/**
 * The days a dragged task can land on: today, tomorrow, the five days after
 * them by weekday, and no date. Further dates go through the date dialog.
 */
export function dayTargets(today: string): DayTarget[] {
  const base = parseISO(today);
  const labels = groupLabels();
  const days: DayTarget[] = [
    { key: "today", label: labels.today, date: today },
    {
      key: "tomorrow",
      label: labels.tomorrow,
      date: toDateKey(addDays(base, 1)),
    },
  ];
  for (let n = 2; n <= 6; n++) {
    const day = addDays(base, n);
    days.push({
      key: `day-${n}`,
      label: format(day, t().common.dates.weekdayDayMonth, {
        locale: dateLocale(),
      }),
      date: toDateKey(day),
    });
  }
  days.push({ key: "undated", label: labels.undated, date: undefined });
  return days;
}

/** The date a whole group stands for, when dropping onto it makes sense. */
export function groupDropDate(
  group: WhenGroup,
  today: string,
): { date: string | undefined } | null {
  if (group === "today") return { date: today };
  if (group === "tomorrow")
    return { date: toDateKey(addDays(parseISO(today), 1)) };
  if (group === "undated") return { date: undefined };
  // Overdue, "this week" and "later" are spans, not days.
  return null;
}
