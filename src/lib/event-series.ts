import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { toDateKey } from "./format";
import { repeatFallsOn } from "./routines";
import type { CalendarEvent, EventException, SeriesScope } from "./types";

/**
 * Recurring events: one stored row, many days on screen. Expansion turns the
 * row into the occurrences inside a window; the plans below turn an edit or a
 * delete on one occurrence into a change to stored rows, for each scope — the
 * same "this / from here on / all" model as recurring transactions.
 */

/** The fields a person edits on one event. */
export type EventFields = Partial<
  Pick<
    CalendarEvent,
    | "title"
    | "date"
    | "startTime"
    | "endTime"
    | "allDay"
    | "location"
    | "notes"
    | "color"
    | "repeat"
    | "until"
    | "reminder"
  >
>;

const OVERRIDABLE = [
  "title",
  "startTime",
  "endTime",
  "allDay",
  "location",
  "notes",
  "color",
] as const;

function shiftDay(date: string, days: number) {
  return toDateKey(addDays(parseISO(date), days));
}

function daysBetween(from: string, to: string) {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

function occurrence(
  series: CalendarEvent,
  day: string,
  exception?: EventException,
): CalendarEvent {
  const shown: CalendarEvent = {
    ...series,
    id: `${series.id}@${day}`,
    date: exception?.newDate ?? day,
    seriesId: series.id,
    occurrenceDate: day,
  };
  if (exception) {
    for (const field of OVERRIDABLE) {
      if (field in exception)
        Object.assign(shown, { [field]: exception[field] });
    }
  }
  return shown;
}

function fallsOn(series: CalendarEvent, day: string) {
  if (!series.repeat) return day === series.date;
  if (day < series.date) return false;
  if (series.until && day > series.until) return false;
  return repeatFallsOn(series.repeat, day, series.date);
}

/** Every event that shows between `from` and `to`, occurrences included. */
export function expandEvents(
  events: CalendarEvent[],
  from: string,
  to: string,
): CalendarEvent[] {
  const shown: CalendarEvent[] = [];
  const span = daysBetween(from, to);

  for (const series of events) {
    if (!series.repeat) {
      if (series.date >= from && series.date <= to) shown.push(series);
      continue;
    }
    const exceptions = new Map(
      (series.exceptions ?? []).map((ex) => [ex.date, ex]),
    );
    const first = series.date > from ? series.date : from;
    for (let i = daysBetween(from, first); i <= span; i++) {
      const day = shiftDay(from, i);
      if (series.until && day > series.until) break;
      if (!fallsOn(series, day)) continue;
      const exception = exceptions.get(day);
      if (exception?.skip) continue;
      const item = occurrence(series, day, exception);
      // Moved out of the window: it shows wherever it went instead.
      if (item.date >= from && item.date <= to) shown.push(item);
    }
    // Moved into the window from a day outside it.
    for (const exception of exceptions.values()) {
      const target = exception.newDate;
      if (!target || exception.skip) continue;
      if (target < from || target > to) continue;
      if (exception.date >= from && exception.date <= to) continue;
      if (!fallsOn(series, exception.date)) continue;
      shown.push(occurrence(series, exception.date, exception));
    }
  }
  return shown;
}

export type EventPlan =
  | { kind: "delete"; id: string }
  | { kind: "update"; id: string; patch: Partial<CalendarEvent> }
  | {
      kind: "split";
      id: string;
      patch: Partial<CalendarEvent>;
      create: Omit<CalendarEvent, "id" | "createdAt">;
    };

function withoutFrom(series: CalendarEvent, day: string) {
  return (series.exceptions ?? []).filter((ex) => ex.date < day);
}

export function planEventDelete(
  series: CalendarEvent,
  day: string,
  scope: SeriesScope,
): EventPlan {
  if (!series.repeat || scope === "all")
    return { kind: "delete", id: series.id };

  if (scope === "this") {
    const others = (series.exceptions ?? []).filter((ex) => ex.date !== day);
    return {
      kind: "update",
      id: series.id,
      patch: { exceptions: [...others, { date: day, skip: true }] },
    };
  }

  // From here on: the series ends the day before. Nothing left → delete.
  if (day <= series.date) return { kind: "delete", id: series.id };
  return {
    kind: "update",
    id: series.id,
    patch: { until: shiftDay(day, -1), exceptions: withoutFrom(series, day) },
  };
}

export function planEventEdit(
  series: CalendarEvent,
  day: string,
  scope: SeriesScope,
  fields: EventFields,
): EventPlan {
  if (!series.repeat) {
    return { kind: "update", id: series.id, patch: fields };
  }

  // Moving an occurrence by N days moves the series' first day by N too.
  const moved = fields.date ? daysBetween(day, fields.date) : 0;
  const rest: EventFields = { ...fields };
  delete rest.date;

  if (scope === "this") {
    const exception: EventException = { date: day };
    if (moved !== 0) exception.newDate = fields.date;
    for (const field of OVERRIDABLE) {
      if (field in fields) Object.assign(exception, { [field]: fields[field] });
    }
    const others = (series.exceptions ?? []).filter((ex) => ex.date !== day);
    return {
      kind: "update",
      id: series.id,
      patch: { exceptions: [...others, exception] },
    };
  }

  if (scope === "all" || day <= series.date) {
    return {
      kind: "update",
      id: series.id,
      patch: { ...rest, date: shiftDay(series.date, moved) },
    };
  }

  // From here on: end the old series the day before, start a new one here.
  const base: Partial<CalendarEvent> = { ...series };
  delete base.id;
  delete base.createdAt;
  delete base.seriesId;
  delete base.occurrenceDate;
  return {
    kind: "split",
    id: series.id,
    patch: { until: shiftDay(day, -1), exceptions: withoutFrom(series, day) },
    create: {
      ...(base as Omit<CalendarEvent, "id" | "createdAt">),
      ...rest,
      date: shiftDay(day, moved),
      exceptions: undefined,
    },
  };
}
