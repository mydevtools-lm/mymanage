import type { Repeat, Routine } from "./types";

/**
 * Routines: which days they fall on, and how to say so in Hebrew.
 * Pure — shared by the server, which makes each day's copy, and the screens.
 */

export const WEEKDAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

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

export function repeatFallsOn(repeat: Repeat, date: string) {
  const d = parse(date);
  switch (repeat.kind) {
    case "daily":
      return true;
    case "weekly":
      return repeat.days.includes(d.getDay());
    case "monthly":
      // "On the 31st" means the last day in shorter months.
      return d.getDate() === Math.min(repeat.day, daysInMonth(d));
  }
}

export function occursOn(
  routine: Pick<Routine, "repeat" | "startDate" | "paused">,
  date: string,
) {
  if (routine.paused || date < routine.startDate) return false;
  return repeatFallsOn(routine.repeat, date);
}

/** The first day from `from` on that the routine falls on, if any soon. */
export function nextOccurrence(
  routine: Pick<Routine, "repeat" | "startDate" | "paused">,
  from: string,
) {
  if (routine.paused) return undefined;
  const d = parse(from < routine.startDate ? routine.startDate : from);
  for (let i = 0; i < 62; i++) {
    const date = key(d);
    if (occursOn(routine, date)) return date;
    d.setDate(d.getDate() + 1);
  }
  return undefined;
}

export function describeRepeat(repeat: Repeat) {
  switch (repeat.kind) {
    case "daily":
      return "כל יום";
    case "weekly": {
      const days = [...new Set(repeat.days)].sort();
      if (days.length === 7) return "כל יום";
      if (days.join() === "0,1,2,3,4") return "ימים א׳–ה׳";
      if (days.length === 1) return `כל יום ${WEEKDAY_SHORT[days[0]]}`;
      return `בימים ${days.map((d) => WEEKDAY_SHORT[d]).join(", ")}`;
    }
    case "monthly":
      return `ב־${repeat.day} בכל חודש`;
  }
}
