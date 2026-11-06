import { addDays, parseISO, subDays } from "date-fns";
import { expandEvents } from "./event-series";
import { localDayOf, toDateKey } from "./format";
import { t } from "./i18n";
import type { CalendarEvent, Task } from "./types";

/**
 * What the morning brief, the Friday summary and the reminders are made of.
 * Pure: everything takes "today" and "now" from the caller.
 */

/* --------------------------------------------------------- morning brief */

export interface MorningBrief {
  tasks: Task[];
  events: CalendarEvent[];
  carriedOver: Task[];
}

export function morningBrief(
  data: { tasks: Task[]; events: CalendarEvent[] },
  today: string,
): MorningBrief {
  const open = data.tasks.filter((t) => !t.archivedAt);
  return {
    tasks: open
      .filter((t) => t.dueDate === today)
      .sort((a, b) => (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99")),
    events: expandEvents(data.events, today, today).sort((a, b) =>
      (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    ),
    carriedOver: open.filter((t) => t.dueDate && t.dueDate < today),
  };
}

/* -------------------------------------------------------- week summary */

export interface WeekSummary {
  from: string;
  done: number;
  /** Open tasks whose day has passed. */
  slipped: number;
}

/**
 * The week so far, from its first day (Sunday unless the preferences say
 * otherwise) to today.
 */
export function weekSummary(
  data: { tasks: Task[] },
  today: string,
  weekStart = 0,
): WeekSummary {
  const day = parseISO(today);
  const from = toDateKey(subDays(day, (day.getDay() - weekStart + 7) % 7));

  const done = data.tasks.filter((t) => {
    if (!t.completed || !t.completedAt) return false;
    const d = localDayOf(t.completedAt);
    return d >= from && d <= today;
  }).length;
  const slipped = data.tasks.filter(
    (t) => !t.archivedAt && t.dueDate && t.dueDate < today,
  ).length;

  return {
    from,
    done,
    slipped,
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

/** The reminder's text: the time, and how long before it the reminder is. */
function reminderBody(time: string, minutes: number) {
  const text = t().today.reminders;
  if (minutes === 0) return text.now(time);
  if (minutes < 60) return text.inMinutes(time, minutes);
  if (minutes === 60) return text.inAnHour(time);
  if (minutes === 1440) return text.tomorrow(time);
  return text.inHours(time, Math.round(minutes / 60));
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
      body: reminderBody(time, minutes),
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
