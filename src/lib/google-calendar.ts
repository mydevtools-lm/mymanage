import "server-only";
import ICAL from "ical.js";

/**
 * Read-only bridge to a Google Calendar private iCal (.ics) address.
 *
 * The address is a secret — anyone holding it can read the whole calendar —
 * so it lives in GOOGLE_CALENDAR_ICS_URL and is only ever used on the server.
 * It must never be sent to the browser.
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
}

// A recurring rule with no end date would iterate forever; stop well past any
// window the UI asks for.
const MAX_OCCURRENCES_PER_EVENT = 400;

export function isConfigured() {
  return !!process.env.GOOGLE_CALENDAR_ICS_URL?.trim();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ICAL.Time already carries the wall-clock fields in its own zone, which is
// what a calendar grid shows — so format from those instead of a JS Date.
function dateKey(t: ICAL.Time) {
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}

function timeKey(t: ICAL.Time) {
  return `${pad(t.hour)}:${pad(t.minute)}`;
}

function toLocal(t: ICAL.Time) {
  // All-day values have no zone; leave them as written.
  if (t.isDate) return t;
  return t.convertToZone(ICAL.Timezone.localTimezone);
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
): ExternalEvent {
  const localStart = toLocal(start);
  const localEnd = toLocal(end);
  const allDay = localStart.isDate;

  return {
    id: `google:${event.uid}:${idSuffix}`,
    title: event.summary?.trim() || "(ללא כותרת)",
    date: dateKey(localStart),
    startTime: allDay ? undefined : timeKey(localStart),
    endTime: allDay ? undefined : timeKey(localEnd),
    allDay,
    location: event.location?.trim() || undefined,
    notes: event.description?.trim() || undefined,
    source: "google",
  };
}

function parseEvents(ics: string, from: string, to: string): ExternalEvent[] {
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
        results.push(buildEvent(event, event.startDate, event.endDate, "once"));
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
        buildEvent(details.item, details.startDate, details.endDate, key),
      );
    }
  }

  return results.sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? "").localeCompare(b.startTime ?? "")
      : a.date.localeCompare(b.date),
  );
}

export async function fetchGoogleEvents(
  from: string,
  to: string,
): Promise<ExternalEvent[]> {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL?.trim();
  if (!url) return [];

  const response = await fetch(url, {
    // Google regenerates the feed slowly; re-fetching more often than this
    // only burns requests.
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error(`Google Calendar returned ${response.status}`);
  }

  return parseEvents(await response.text(), from, to);
}
