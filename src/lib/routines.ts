import { t } from "./i18n";
import type { Repeat, Routine } from "./types";

/**
 * Routines: which days they fall on, and how to say so in Hebrew.
 * Pure — shared by the server, which makes each day's copy, and the screens.
 */

/** Short weekday names, Sunday first (as Date.getDay() counts). */
export function weekdayShort() {
  return t().tasks.weekdayShort;
}

function parse(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function key(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** The id of a routine's copy for one day — the same on client and server,
 *  so making it twice is harmless. */
export function instanceId(routineId: string, date: string) {
  return `${routineId}_${date}`;
}

export function repeatFallsOn(repeat: Repeat, date: string, startDate = date) {
  const d = parse(date);
  switch (repeat.kind) {
    case "daily":
      return true;
    case "weekly":
      return repeat.days.includes(d.getDay());
    case "monthly":
      // "On the 31st" means the last day in shorter months.
      return d.getDate() === Math.min(repeat.day, daysInMonth(d));
    case "yearly": {
      const start = parse(startDate);
      if (d.getMonth() !== start.getMonth()) return false;
      // Born on 29 February: celebrate on the 28th in ordinary years.
      return d.getDate() === Math.min(start.getDate(), daysInMonth(d));
    }
  }
}

export function occursOn(
  routine: Pick<Routine, "repeat" | "startDate" | "paused">,
  date: string,
) {
  if (routine.paused || date < routine.startDate) return false;
  return repeatFallsOn(routine.repeat, date, routine.startDate);
}

/** The first day from `from` on that the routine falls on, if any soon. */
export function nextOccurrence(
  routine: Pick<Routine, "repeat" | "startDate" | "paused">,
  from: string,
) {
  if (routine.paused) return undefined;
  const d = parse(from < routine.startDate ? routine.startDate : from);
  for (let i = 0; i < 366; i++) {
    const date = key(d);
    if (occursOn(routine, date)) return date;
    d.setDate(d.getDate() + 1);
  }
  return undefined;
}

export function describeRepeat(repeat: Repeat) {
  const text = t().tasks.describe;
  const weekdays = weekdayShort();
  switch (repeat.kind) {
    case "daily":
      return text.everyDay;
    case "weekly": {
      const days = [...new Set(repeat.days)].sort();
      if (days.length === 7) return text.everyDay;
      if (days.join() === "0,1,2,3,4") return text.sundayToThursday;
      if (days.length === 1) return text.everyWeekday(weekdays[days[0]]);
      return text.onDays(days.map((d) => weekdays[d]).join(", "));
    }
    case "monthly":
      return text.monthly(repeat.day);
    case "yearly":
      return text.yearly;
  }
}
