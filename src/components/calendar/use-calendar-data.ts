"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { expandEvents } from "@/lib/event-series";
import { useGoogleEvents, type ExternalEvent } from "@/lib/use-google-events";
import { useHolidays } from "@/lib/use-holidays";
import type { CalendarEvent, Task } from "@/lib/types";

export interface DayData {
  events: CalendarEvent[];
  google: ExternalEvent[];
  tasks: Task[];
}

const EMPTY: DayData = { events: [], google: [], tasks: [] };

function byTime(a?: string, b?: string) {
  // Untimed first — they read as "all day" at the top of a day.
  return (a ?? "").localeCompare(b ?? "");
}

/**
 * Local events, Google events and dated tasks for a date range, bucketed by
 * day. Every calendar view reads the same shape.
 */
export function useCalendarData(from: string, to: string) {
  const events = useAppStore((s) => s.events);
  const tasks = useAppStore((s) => s.tasks);
  const google = useGoogleEvents(from, to);
  const holidays = useHolidays(from, to);

  const byDay = useMemo(() => {
    const map = new Map<string, DayData>();
    const bucket = (day: string) => {
      let entry = map.get(day);
      if (!entry) {
        entry = { events: [], google: [], tasks: [] };
        map.set(day, entry);
      }
      return entry;
    };
    // Recurring events arrive as one occurrence per day they fall on.
    for (const e of expandEvents(events, from, to))
      bucket(e.date).events.push(e);
    // Google events and holidays are both read-only and from outside: one list.
    for (const e of [...google.events, ...holidays.events])
      bucket(e.date).google.push(e);
    for (const t of tasks) {
      if (t.dueDate && t.dueDate >= from && t.dueDate <= to) {
        bucket(t.dueDate).tasks.push(t);
      }
    }
    for (const day of map.values()) {
      day.events.sort((a, b) => byTime(a.startTime, b.startTime));
      day.google.sort((a, b) => byTime(a.startTime, b.startTime));
      day.tasks.sort((a, b) => byTime(a.dueTime, b.dueTime));
    }
    return map;
  }, [events, tasks, google.events, holidays.events, from, to]);

  return {
    day: (key: string) => byDay.get(key) ?? EMPTY,
    google,
    holidays,
  };
}
