"use client";

import { Fragment } from "react";
import { Lock, MapPin } from "lucide-react";
import { TaskRow } from "@/components/tasks/task-row";
import { COLOR_STYLES } from "@/lib/colors";
import type { AllDayItem, TimelineItem } from "@/lib/agenda";
import type { CalendarEvent, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const GOOGLE_STYLE = "border-s-sky-500 bg-sky-50/70 dark:bg-sky-950/30";

function range(time: string, endTime?: string) {
  return endTime ? `${time}–${endTime}` : time;
}

function nowKey() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AllDayStrip({
  items,
  onEditEvent,
}: {
  items: AllDayItem[];
  onEditEvent: (event: CalendarEvent) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) =>
        item.kind === "event" ? (
          <button
            key={item.key}
            type="button"
            onClick={() => onEditEvent(item.event)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-opacity hover:opacity-80",
              COLOR_STYLES[item.event.color].badge,
            )}
          >
            {item.event.title}
          </button>
        ) : (
          <span
            key={item.key}
            title="מגוגל יומן — קריאה בלבד"
            className="flex items-center gap-1.5 rounded-full border-s-2 border-s-sky-500 bg-sky-50 px-3 py-1 text-sm text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
          >
            {item.event.title}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * The day in order: appointments and timed tasks, with a "now" line when the
 * day shown is today. Events that already ended are dimmed.
 */
export function DayTimeline({
  items,
  isToday,
  onEditEvent,
  onEditTask,
}: {
  items: TimelineItem[];
  isToday: boolean;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
}) {
  if (items.length === 0) return null;

  const now = isToday ? nowKey() : null;
  // The "now" line goes before the first item that hasn't started yet.
  const nowIndex = now
    ? (() => {
        const i = items.findIndex((item) => item.time > now);
        return i === -1 ? items.length : i;
      })()
    : -1;

  const past = (item: TimelineItem) =>
    !!now && item.kind !== "task" && (item.endTime ?? item.time) < now;

  const nowLine = (
    <li
      aria-label={`עכשיו, ${now}`}
      className="flex items-center gap-3 py-1 text-xs font-medium text-destructive"
    >
      <span className="w-12 shrink-0 text-end tabular-nums">{now}</span>
      <span className="h-px flex-1 bg-destructive/60" />
    </li>
  );

  return (
    <ol className="grid gap-2">
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index === nowIndex && nowLine}
          <li className="flex items-start gap-3">
            <time
              className={cn(
                "w-12 shrink-0 pt-2.5 text-end text-sm tabular-nums text-muted-foreground",
                past(item) && "opacity-50",
              )}
            >
              {item.time}
            </time>
            <div className={cn("min-w-0 flex-1", past(item) && "opacity-60")}>
              {item.kind === "task" ? (
                <TaskRow task={item.task} onEdit={onEditTask} hideDate />
              ) : item.kind === "event" ? (
                <button
                  type="button"
                  onClick={() => onEditEvent(item.event)}
                  className={cn(
                    "w-full rounded-lg border border-s-4 px-3 py-2 text-start transition-colors hover:brightness-95",
                    COLOR_STYLES[item.event.color].soft,
                  )}
                >
                  <div className="font-medium">{item.event.title}</div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {range(item.time, item.endTime)}
                    </span>
                    {item.event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {item.event.location}
                      </span>
                    )}
                  </div>
                </button>
              ) : (
                <div
                  className={cn(
                    "rounded-lg border border-s-4 px-3 py-2",
                    GOOGLE_STYLE,
                  )}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {item.event.title}
                    <Lock
                      className="size-3 text-muted-foreground"
                      aria-label="מגוגל יומן — קריאה בלבד"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {range(item.time, item.endTime)}
                    </span>
                    {item.event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {item.event.location}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </li>
        </Fragment>
      ))}
      {nowIndex === items.length && nowLine}
    </ol>
  );
}
