import ICAL from "ical.js";
import { t } from "./i18n";

/**
 * Google Calendar's .ics feed → events in a date window, in this machine's
 * time. Shared by the server route (google-calendar.ts) and the desktop app,
 * where Rust downloads the feed and this file reads it.
 */

export interface ExternalEvent {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  allDay: boolean;
  location?: string;
  notes?: string;
  source: "google";
  /** Which calendar (by number) the event comes from. */
  calendarId: string;
}

// A recurring rule with no end date would iterate forever; stop well past any
// window the UI asks for.
const MAX_OCCURRENCES_PER_EVENT = 400;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Wall-clock fields, as the calendar grid shows them. */
interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isDate: boolean;
}

function dateKey(t: WallTime) {
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}

function timeKey(t: WallTime) {
  return `${pad(t.hour)}:${pad(t.minute)}`;
}

/**
 * The same moment on this machine's clock. Going through an absolute JS Date
 * handles every form a feed uses — UTC ("…Z", common in Google feeds), a
 * TZID with its VTIMEZONE, or floating. (ICAL's own "local timezone" leaves
 * UTC times in UTC, which showed a 13:00 meeting at 10:00.)
 */
function toLocal(t: ICAL.Time): WallTime {
  // All-day values have no zone; leave them as written.
  if (t.isDate) {
    return {
      year: t.year,
      month: t.month,
      day: t.day,
      hour: 0,
      minute: 0,
      isDate: true,
    };
  }
  const d = t.toJSDate();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    isDate: false,
  };
}

function firstStringValue(
  component: ICAL.Component,
  name: string,
): string | undefined {
  const value = component.getFirstPropertyValue(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildEvent(
  event: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time,
  idSuffix: string,
  calendarId: string,
): ExternalEvent {
  const localStart = toLocal(start);
  const localEnd = toLocal(end);
  const allDay = localStart.isDate;

  return {
    id: `google:${calendarId}:${event.uid}:${idSuffix}`,
    title: event.summary?.trim() || t().data.untitledEvent,
    date: dateKey(localStart),
    startTime: allDay ? undefined : timeKey(localStart),
    endTime: allDay ? undefined : timeKey(localEnd),
    allDay,
    location: event.location?.trim() || undefined,
    notes: event.description?.trim() || undefined,
    source: "google",
    calendarId,
  };
}

export function parseEvents(
  ics: string,
  from: string,
  to: string,
  calendarId = "1",
): ExternalEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics));

  // Google ships the VTIMEZONE definitions inside the feed; registering them
  // lets TZID=... resolve instead of silently falling back to UTC.
  for (const vtimezone of root.getAllSubcomponents("vtimezone")) {
    const tzid = vtimezone.getFirstPropertyValue("tzid");
    if (typeof tzid === "string" && !ICAL.TimezoneService.has(tzid)) {
      ICAL.TimezoneService.register(vtimezone);
    }
  }

  const components = root.getAllSubcomponents("vevent");
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];

  for (const component of components) {
    if (firstStringValue(component, "status") === "CANCELLED") continue;
    const event = new ICAL.Event(component);
    if (event.isRecurrenceException()) exceptions.push(event);
    else if (event.uid) masters.set(event.uid, event);
  }

  // A moved or edited single occurrence arrives as its own VEVENT; attaching it
  // to its master makes the expansion below return the edited version.
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else masters.set(`${exception.uid}:${exception.recurrenceId}`, exception);
  }

  const results: ExternalEvent[] = [];

  for (const event of masters.values()) {
    if (!event.isRecurring()) {
      const key = dateKey(toLocal(event.startDate));
      if (key >= from && key <= to) {
        results.push(
          buildEvent(event, event.startDate, event.endDate, "once", calendarId),
        );
      }
      continue;
    }

    const iterator = event.iterator();
    let next: ICAL.Time | null;
    let seen = 0;

    while ((next = iterator.next()) && seen < MAX_OCCURRENCES_PER_EVENT) {
      seen += 1;
      const key = dateKey(toLocal(next));
      if (key > to) break;
      if (key < from) continue;

      const details = event.getOccurrenceDetails(next);
      results.push(
        buildEvent(
          details.item,
          details.startDate,
          details.endDate,
          key,
          calendarId,
        ),
      );
    }
  }

  return results.sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? "").localeCompare(b.startTime ?? "")
      : a.date.localeCompare(b.date),
  );
}
