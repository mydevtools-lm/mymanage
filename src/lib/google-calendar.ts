import "server-only";
import ICAL from "ical.js";

/**
 * Read-only bridge to Google Calendar private iCal (.ics) addresses.
 *
 * Each address is a secret — anyone holding it can read the whole calendar —
 * so they live in .env.local and are only ever used on the server. They must
 * never be sent to the browser; calendars are known there by number only.
 *
 * GOOGLE_CALENDAR_ICS_URL is calendar 1; GOOGLE_CALENDAR_ICS_URL_2 … _9 add
 * more, each with an optional GOOGLE_CALENDAR_NAME / _NAME_<n> for display.
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

export interface CalendarSource {
  id: string;
  name: string;
  url: string;
}

export function calendarSources(
  env: Record<string, string | undefined> = process.env,
): CalendarSource[] {
  const sources: CalendarSource[] = [];
  const first = env.GOOGLE_CALENDAR_ICS_URL?.trim();
  if (first) {
    sources.push({
      id: "1",
      name: env.GOOGLE_CALENDAR_NAME?.trim() || "גוגל יומן",
      url: first,
    });
  }
  for (let n = 2; n <= 9; n++) {
    const url = env[`GOOGLE_CALENDAR_ICS_URL_${n}`]?.trim();
    if (!url) continue;
    sources.push({
      id: String(n),
      name: env[`GOOGLE_CALENDAR_NAME_${n}`]?.trim() || `יומן ${n}`,
      url,
    });
  }
  return sources;
}

// A recurring rule with no end date would iterate forever; stop well past any
// window the UI asks for.
const MAX_OCCURRENCES_PER_EVENT = 400;

export function isConfigured() {
  return calendarSources().length > 0;
}

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
    title: event.summary?.trim() || "(ללא כותרת)",
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

async function fetchCalendar(source: CalendarSource, from: string, to: string) {
  const response = await fetch(source.url, {
    // Google regenerates the feed slowly; re-fetching more often than this
    // only burns requests.
    next: { revalidate: 600 },
  });
  if (!response.ok) {
    throw new Error(`Google Calendar ${source.id} returned ${response.status}`);
  }
  return parseEvents(await response.text(), from, to, source.id);
}

export interface CalendarsResult {
  /** Number and display name only — never the secret address. */
  calendars: { id: string; name: string; failed?: boolean }[];
  events: ExternalEvent[];
}

/** All configured calendars at once; one failing leaves the rest showing. */
export async function fetchGoogleCalendars(
  from: string,
  to: string,
): Promise<CalendarsResult> {
  const sources = calendarSources();
  const settled = await Promise.allSettled(
    sources.map((source) => fetchCalendar(source, from, to)),
  );
  const calendars: CalendarsResult["calendars"] = [];
  const events: ExternalEvent[] = [];
  settled.forEach((result, index) => {
    const { id, name } = sources[index];
    if (result.status === "fulfilled") {
      calendars.push({ id, name });
      events.push(...result.value);
    } else {
      console.error(`Google Calendar ${id} fetch failed:`, result.reason);
      calendars.push({ id, name, failed: true });
    }
  });
  events.sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? "").localeCompare(b.startTime ?? "")
      : a.date.localeCompare(b.date),
  );
  return { calendars, events };
}
