import "server-only";
import { parseEvents, type ExternalEvent } from "./ical-parse";

export { parseEvents, type ExternalEvent };

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

export function isConfigured() {
  return calendarSources().length > 0;
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
