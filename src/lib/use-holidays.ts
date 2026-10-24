"use client";

import { useMemo } from "react";
import { useAppStore } from "./store";
import { holidaysBetween, HOLIDAY_GROUPS } from "./holidays";
import { useLocale } from "./i18n/use-locale";
import { t } from "./i18n";
import type { ColorKey } from "./types";
import type { ExternalEvent } from "./use-google-events";

export interface HolidayCalendar {
  id: string;
  name: string;
  color: ColorKey;
  hidden: boolean;
}

/**
 * The holidays for a date window, with the name, tint and visibility each
 * group has in the preferences. Events of a hidden group are left out.
 */
export function useHolidays(from: string, to: string) {
  const prefs = useAppStore((s) => s.settings.calendars);
  const locale = useLocale();

  return useMemo(() => {
    const names = t(locale).calendar.holidays;
    const calendars: HolidayCalendar[] = HOLIDAY_GROUPS.map((g) => ({
      id: g.id,
      name: prefs?.[g.id]?.name?.trim() || names[g.group],
      color: prefs?.[g.id]?.color ?? g.color,
      hidden: !!prefs?.[g.id]?.hidden,
    }));
    const byId = new Map(calendars.map((c) => [c.id, c]));
    const events: ExternalEvent[] = holidaysBetween(from, to, locale)
      .filter((e) => !byId.get(e.calendarId)?.hidden)
      .map((e) => ({ ...e, color: byId.get(e.calendarId)?.color }));
    return { events, calendars };
  }, [from, to, prefs, locale]);
}
