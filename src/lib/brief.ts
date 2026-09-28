import { addDays, parseISO, subDays } from "date-fns";
import { expandEvents } from "./event-series";
import { getMonthTransactions, summarize } from "./finance";
import { localDayOf, toDateKey } from "./format";
import type { CalendarEvent, Task, Transaction } from "./types";

/**
 * What the morning brief, the Friday summary and the reminders are made of.
 * Pure: everything takes "today" and "now" from the caller.
 */

/* --------------------------------------------------------------- bills */

export interface Bill {
  id: string;
  description: string;
  amount: number;
  date: string;
  daysLeft: number;
}

/** Recurring expenses that fall due in the next `days` days, today included. */
export function upcomingBills(
  transactions: Transaction[],
  today: string,
  days = 3,
): Bill[] {
  const end = toDateKey(addDays(parseISO(today), days));
  const months = [...new Set([today.slice(0, 7), end.slice(0, 7)])];
  return months
    .flatMap((m) => getMonthTransactions(transactions, m))
    .filter(
      (t) =>
        t.recurring && t.type === "expense" && t.date >= today && t.date <= end,
    )
    .map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      daysLeft: Math.round(
        (Date.parse(t.date) - Date.parse(today)) / 86_400_000,
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* --------------------------------------------------------- morning brief */

export interface MorningBrief {
  tasks: Task[];
  events: CalendarEvent[];
  carriedOver: Task[];
  bills: Bill[];
  month: { income: number; expense: number; balance: number };
}

export function morningBrief(
  data: { tasks: Task[]; events: CalendarEvent[]; transactions: Transaction[] },
  today: string,
): MorningBrief {
  const open = data.tasks.filter((t) => !t.archivedAt);
  // The month so far: what has happened, not what is planned for later.
  const month = summarize(
    getMonthTransactions(data.transactions, today.slice(0, 7)).filter(
      (t) => t.date <= today,
    ),
  );
  return {
    tasks: open
      .filter((t) => t.dueDate === today)
      .sort((a, b) => (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99")),
    events: expandEvents(data.events, today, today).sort((a, b) =>
      (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    ),
    carriedOver: open.filter((t) => t.dueDate && t.dueDate < today),
    bills: upcomingBills(data.transactions, today),
    month,
  };
}

/* -------------------------------------------------------- week summary */

export interface WeekSummary {
  from: string;
  done: number;
  /** Open tasks whose day has passed. */
  slipped: number;
  expense: number;
  lastWeekExpense: number;
}

/** The week so far, Sunday to today, against the same days a week before. */
export function weekSummary(
  data: { tasks: Task[]; transactions: Transaction[] },
  today: string,
): WeekSummary {
  const day = parseISO(today);
  const from = toDateKey(subDays(day, day.getDay()));
  const lastFrom = toDateKey(subDays(parseISO(from), 7));
  const lastTo = toDateKey(subDays(day, 7));

  const done = data.tasks.filter((t) => {
    if (!t.completed || !t.completedAt) return false;
    const d = localDayOf(t.completedAt);
    return d >= from && d <= today;
  }).length;
  const slipped = data.tasks.filter(
    (t) => !t.archivedAt && t.dueDate && t.dueDate < today,
  ).length;

  const spent = (start: string, end: string) => {
    const months = [...new Set([start.slice(0, 7), end.slice(0, 7)])];
    return months
      .flatMap((m) => getMonthTransactions(data.transactions, m))
      .filter((t) => t.type === "expense" && t.date >= start && t.date <= end)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return {
    from,
    done,
    slipped,
    expense: spent(from, today),
    lastWeekExpense: spent(lastFrom, lastTo),
  };
}

/* ------------------------------------------------------------ reminders */

export interface Reminder {
  /** Unique per item and day, so each fires once. */
  key: string;
  title: string;
  body: string;
  at: number; // ms
}

function at(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

function beforeText(minutes: number) {
  if (minutes === 0) return "עכשיו";
  if (minutes < 60) return `בעוד ${minutes} דקות`;
  if (minutes === 60) return "בעוד שעה";
  if (minutes === 1440) return "מחר";
  return `בעוד ${Math.round(minutes / 60)} שעות`;
}

/**
 * Reminders that are due now: their moment has come, the thing itself
 * hasn't started more than an hour ago, and they haven't fired yet.
 */
export function dueReminders(
  data: { tasks: Task[]; events: CalendarEvent[] },
  now: Date,
  fired: Set<string>,
): Reminder[] {
  const nowMs = now.getTime();
  const today = toDateKey(now);
  const tomorrow = toDateKey(addDays(now, 1));
  const due: Reminder[] = [];
  const consider = (
    key: string,
    title: string,
    date: string,
    time: string,
    minutes: number,
  ) => {
    const start = at(date, time);
    const moment = start - minutes * 60_000;
    if (moment > nowMs || nowMs > start + 60 * 60_000) return;
    if (fired.has(key)) return;
    due.push({
      key,
      title,
      body: `${time} · ${beforeText(minutes)}`,
      at: moment,
    });
  };

  for (const t of data.tasks) {
    if (t.archivedAt || t.reminder == null || !t.dueDate || !t.dueTime)
      continue;
    consider(
      `task:${t.id}@${t.dueDate}`,
      t.title,
      t.dueDate,
      t.dueTime,
      t.reminder,
    );
  }
  // Tomorrow too: a "day before" reminder for tomorrow comes due today.
  for (const e of expandEvents(data.events, today, tomorrow)) {
    if (e.reminder == null || e.allDay || !e.startTime) continue;
    consider(
      `event:${e.id}@${e.date}`,
      e.title,
      e.date,
      e.startTime,
      e.reminder,
    );
  }
  return due.sort((a, b) => a.at - b.at);
}
