"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "./store";
import { defaultCalendarColor } from "@/components/calendar/chips";
import type { ColorKey } from "./types";
import { isTauri } from "./platform";

export interface ExternalEvent {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  source: "google";
  /** Which Google calendar, by its number in .env.local. */
  calendarId: string;
  /** The calendar's tint, from settings › connections. */
  color?: ColorKey;
}

export interface GoogleCalendar {
  id: string;
  name: string;
  failed?: boolean;
  color: ColorKey;
  hidden: boolean;
}

interface State {
  /** Only the calendars that are shown. */
  events: ExternalEvent[];
  calendars: GoogleCalendar[];
  configured: boolean;
  loading: boolean;
  error: string | null;
}

interface Fetched {
  events: ExternalEvent[];
  calendars: { id: string; name: string; failed?: boolean }[];
  configured: boolean;
  loading: boolean;
  error: string | null;
}

const EMPTY: ExternalEvent[] = [];

/**
 * Read-only Google Calendar events for a date window. The secret iCal
 * addresses stay on the server; this only ever talks to our own route
 * handler. Hidden calendars are left out, and each event carries its
 * calendar's colour.
 */
export function useGoogleEvents(from: string, to: string): State {
  const [fetched, setFetched] = useState<Fetched>({
    events: EMPTY,
    calendars: [],
    configured: false,
    loading: true,
    error: null,
  });
  const prefs = useAppStore((s) => s.settings.calendars);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      // The calendar addresses are secrets the desktop app can't hold until
      // sprint ד2; until then it shows "not connected", as a fresh server does.
      if (isTauri()) {
        setFetched({
          events: EMPTY,
          calendars: [],
          configured: false,
          loading: false,
          error: null,
        });
        return;
      }
      try {
        const response = await fetch(
          `/api/calendar/google?from=${from}&to=${to}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        setFetched({
          events: data.events ?? EMPTY,
          calendars: data.calendars ?? [],
          configured: !!data.configured,
          loading: false,
          error: data.error ?? null,
        });
      } catch {
        if (controller.signal.aborted) return;
        setFetched({
          events: EMPTY,
          calendars: [],
          configured: false,
          loading: false,
          error: "החיבור ליומן גוגל נכשל",
        });
      }
    }

    load();
    return () => controller.abort();
  }, [from, to]);

  return useMemo(() => {
    const calendars = fetched.calendars.map((c) => ({
      ...c,
      color: prefs?.[c.id]?.color ?? defaultCalendarColor(c.id),
      hidden: !!prefs?.[c.id]?.hidden,
    }));
    const byId = new Map(calendars.map((c) => [c.id, c]));
    const events = fetched.events
      .filter((e) => !byId.get(e.calendarId)?.hidden)
      .map((e) => ({
        ...e,
        color: byId.get(e.calendarId)?.color ?? "sky",
      }));
    return { ...fetched, calendars, events };
  }, [fetched, prefs]);
}
