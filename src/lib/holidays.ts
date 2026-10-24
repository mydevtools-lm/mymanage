import { getLocale, type Locale } from "./i18n";
import {
  HOLIDAYS,
  HOLIDAYS_FROM,
  HOLIDAYS_TO,
  type HolidayGroup,
} from "./holidays-data";
import type { ExternalEvent } from "./use-google-events";
import type { ColorKey } from "./types";

/**
 * Israel's holidays and memorial and national days, as read-only all-day
 * events (sprint ד10). The dates are computed ahead of time by
 * scripts/gen-holidays.mjs, so nothing here needs a network or a calendar
 * library. They behave like a calendar of their own: each group can be
 * hidden or tinted in Settings › Preferences, through the same per-calendar
 * preferences as the Google calendars.
 */

export { HOLIDAYS_FROM, HOLIDAYS_TO };

export const HOLIDAY_GROUPS: {
  group: HolidayGroup;
  /** Key in the calendar preferences (settings.calendars). */
  id: string;
  color: ColorKey;
}[] = [
  { group: "jewish", id: "holidays-jewish", color: "amber" },
  { group: "national", id: "holidays-national", color: "sky" },
];

const idOf = (group: HolidayGroup) =>
  HOLIDAY_GROUPS.find((g) => g.group === group)!.id;

/** The holidays that fall between two days (inclusive), in the language. */
export function holidaysBetween(
  from: string,
  to: string,
  locale: Locale = getLocale(),
): ExternalEvent[] {
  const events: ExternalEvent[] = [];
  for (const row of HOLIDAYS) {
    if (row.d < from) continue;
    if (row.d > to) break; // the data is sorted by day
    events.push({
      id: `${idOf(row.g)}:${row.d}:${row.en}`,
      title: row[locale],
      date: row.d,
      allDay: true,
      source: "holidays",
      calendarId: idOf(row.g),
    });
  }
  return events;
}
