import type { CalendarEvent, Task } from "./types";
import { localDayOf } from "./format";
import type { ExternalEvent } from "./use-google-events";

/**
 * Everything that happens on one day, in the shape the Today screen draws:
 * an all-day strip, a timeline ordered by start time, and the day's tasks
 * that have no time of their own.
 */

export type TimelineItem =
  | {
      kind: "event";
      key: string;
      time: string; // HH:mm
      endTime?: string;
      event: CalendarEvent;
    }
  | {
      kind: "google";
      key: string;
      time: string;
      endTime?: string;
      event: ExternalEvent;
    }
  | { kind: "task"; key: string; time: string; task: Task };

export type AllDayItem =
  | { kind: "event"; key: string; event: CalendarEvent }
  | { kind: "google"; key: string; event: ExternalEvent };

export interface DayAgenda {
  allDay: AllDayItem[];
  timeline: TimelineItem[];
  /** Open tasks due this day without a time. */
  untimedTasks: Task[];
  /** Only filled in when the day is today: open tasks whose date passed. */
  carriedOver: Task[];
  /** Tasks with no date at all — shown on today only. */
  undated: Task[];
  /** Ticked off on this day, whatever their original date. */
  doneCount: number;
}

// Kind order breaks ties at the same minute: fixed appointments before tasks.
const KIND_RANK = { event: 0, google: 1, task: 2 } as const;

export function buildDayAgenda({
  date,
  today,
  tasks,
  events,
  googleEvents,
}: {
  date: string;
  today: string;
  tasks: Task[];
  events: CalendarEvent[];
  googleEvents: ExternalEvent[];
}): DayAgenda {
  const allDay: AllDayItem[] = [];
  const timeline: TimelineItem[] = [];

  for (const event of events) {
    if (event.date !== date) continue;
    if (event.allDay || !event.startTime) {
      allDay.push({ kind: "event", key: event.id, event });
    } else {
      timeline.push({
        kind: "event",
        key: event.id,
        time: event.startTime,
        endTime: event.endTime,
        event,
      });
    }
  }

  for (const event of googleEvents) {
    if (event.date !== date) continue;
    if (event.allDay || !event.startTime) {
      allDay.push({ kind: "google", key: event.id, event });
    } else {
      timeline.push({
        kind: "google",
        key: event.id,
        time: event.startTime,
        endTime: event.endTime,
        event,
      });
    }
  }

  const active = tasks.filter((t) => !t.archivedAt);
  const untimedTasks: Task[] = [];
  for (const task of active) {
    if (task.dueDate !== date) continue;
    if (task.dueTime) {
      timeline.push({ kind: "task", key: task.id, time: task.dueTime, task });
    } else {
      untimedTasks.push(task);
    }
  }

  timeline.sort(
    (a, b) =>
      a.time.localeCompare(b.time) || KIND_RANK[a.kind] - KIND_RANK[b.kind],
  );

  const isToday = date === today;
  const carriedOver = isToday
    ? active
        .filter((t) => t.dueDate && t.dueDate < today)
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    : [];
  const undated = isToday ? active.filter((t) => !t.dueDate) : [];

  const doneCount = tasks.filter(
    (t) => t.archivedAt && localDayOf(t.completedAt ?? t.archivedAt) === date,
  ).length;

  return { allDay, timeline, untimedTasks, carriedOver, undated, doneCount };
}

/**
 * Progress for the day's bar: what was finished today against what was on
 * the plate — due today, timed or not, plus anything dragged in from before.
 * Undated tasks aren't counted: they were never promised to a day.
 */
export function dayProgress(agenda: DayAgenda) {
  const timedTasks = agenda.timeline.filter((i) => i.kind === "task").length;
  const pending =
    agenda.untimedTasks.length + timedTasks + agenda.carriedOver.length;
  const total = pending + agenda.doneCount;
  return {
    done: agenda.doneCount,
    total,
    ratio: total === 0 ? 0 : agenda.doneCount / total,
  };
}
