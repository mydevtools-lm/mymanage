"use client";

import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Lock } from "lucide-react";
import { COLOR_STYLES } from "@/lib/colors";
import { TimeRange } from "@/components/time-range";
import { toDateKey, todayKey } from "@/lib/format";
import { layoutDay, type Timed } from "@/lib/week-layout";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Task } from "@/lib/types";
import type { ExternalEvent } from "@/lib/use-google-events";
import type { DayData } from "./use-calendar-data";
import {
  GOOGLE_CHIP,
  TASK_CHIP_DONE,
  TASK_CHIP_OPEN,
  timeRange,
} from "./chips";

const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;
const FIRST_VISIBLE_HOUR = 7;

type Block = Timed &
  (
    | { kind: "event"; event: CalendarEvent }
    | { kind: "google"; event: ExternalEvent }
    | { kind: "task"; task: Task }
  );

function blocksOf({ events, google, tasks }: DayData): Block[] {
  return [
    ...events
      .filter((e) => !e.allDay && e.startTime)
      .map((e) => ({
        kind: "event" as const,
        key: e.id,
        start: e.startTime!,
        end: e.endTime,
        event: e,
      })),
    ...google
      .filter((e) => !e.allDay && e.startTime)
      .map((e) => ({
        kind: "google" as const,
        key: e.id,
        start: e.startTime!,
        end: e.endTime,
        event: e,
      })),
    ...tasks
      .filter((t) => t.dueTime)
      .map((t) => ({
        kind: "task" as const,
        key: t.id,
        start: t.dueTime!,
        end: undefined,
        task: t,
      })),
  ];
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Seven day columns over a 24-hour grid. Items without a time sit in a strip
 * above the grid. Clicking an empty hour starts a new event at that hour.
 */
export function WeekView({
  days,
  day,
  onSelectDay,
  onEditEvent,
  onEditTask,
  onCreateAt,
}: {
  days: Date[];
  day: (key: string) => DayData;
  onSelectDay: (key: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
  onCreateAt: (date: string, hour: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const today = todayKey();

  // Open on the working day, not at midnight.
  useEffect(() => {
    scroller.current?.scrollTo({ top: FIRST_VISIBLE_HOUR * HOUR_PX });
  }, []);

  const columns = days.map((date) => {
    const key = toDateKey(date);
    const data = day(key);
    return {
      date,
      key,
      data,
      allDay: [
        ...data.events.filter((e) => e.allDay || !e.startTime),
        ...data.google.filter((e) => e.allDay || !e.startTime),
      ],
      untimedTasks: data.tasks.filter((t) => !t.dueTime),
      placed: layoutDay(blocksOf(data)),
    };
  });

  const hasStrip = columns.some(
    (c) => c.allDay.length > 0 || c.untimedTasks.length > 0,
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Day headers */}
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b bg-muted/50">
        <div />
        {columns.map(({ date, key }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDay(key)}
            className="flex flex-col items-center py-1.5 text-xs transition-colors can-hover:hover:bg-accent/60"
          >
            <span className="text-muted-foreground">
              {format(date, "EEEEEE", { locale: he })}
            </span>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-sm font-medium",
                key === today && "bg-primary text-primary-foreground",
              )}
            >
              {format(date, "d")}
            </span>
          </button>
        ))}
      </div>

      {/* All-day and untimed strip */}
      {hasStrip && (
        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b">
          <div className="px-1 py-1 text-end text-[10px] text-muted-foreground">
            כל היום
          </div>
          {columns.map(({ key, allDay, untimedTasks }) => (
            <div
              key={key}
              className="flex min-w-0 flex-col gap-0.5 border-s p-0.5"
            >
              {allDay.map((e) =>
                "source" in e ? (
                  <span
                    key={e.id}
                    title={e.title}
                    className={cn(
                      "truncate rounded px-1 text-[11px] leading-5",
                      GOOGLE_CHIP,
                    )}
                  >
                    {e.title}
                  </span>
                ) : (
                  <button
                    key={e.id}
                    type="button"
                    title={e.title}
                    onClick={() => onEditEvent(e)}
                    className={cn(
                      "truncate rounded px-1 text-start text-[11px] leading-5",
                      COLOR_STYLES[e.color].badge,
                    )}
                  >
                    {e.title}
                  </button>
                ),
              )}
              {untimedTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.title}
                  onClick={() => onEditTask(t)}
                  className={cn(
                    "truncate rounded px-1 text-start text-[11px] leading-5",
                    t.completed ? TASK_CHIP_DONE : TASK_CHIP_OPEN,
                  )}
                >
                  {t.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Hour grid */}
      <div ref={scroller} className="max-h-[65dvh] overflow-y-auto">
        <div
          className="relative grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]"
          style={{ height: 24 * HOUR_PX }}
        >
          {/* Hour labels */}
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute inset-x-0 -translate-y-2 pe-1.5 text-end text-[10px] tabular-nums text-muted-foreground"
                style={{ top: h * HOUR_PX }}
              >
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {columns.map(({ key, placed }) => (
            <div key={key} className="relative border-s">
              {/* Clickable hour slots underneath the blocks */}
              {Array.from({ length: 24 }, (_, h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`אירוע חדש ב־${String(h).padStart(2, "0")}:00`}
                  onClick={() => onCreateAt(key, h)}
                  className="absolute inset-x-0 border-t border-border/60 transition-colors can-hover:hover:bg-accent/40"
                  style={{ top: h * HOUR_PX, height: HOUR_PX }}
                />
              ))}

              {key === today && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
                  style={{ top: nowMinutes() * PX_PER_MIN }}
                />
              )}

              {placed.map(({ item, top, height, lane, lanes }) => {
                const style = {
                  top: top * PX_PER_MIN,
                  height: height * PX_PER_MIN - 2,
                  // Logical inset so lanes flow right-to-left like the page.
                  insetInlineStart: `calc(${(lane / lanes) * 100}% + 2px)`,
                  width: `calc(${100 / lanes}% - 4px)`,
                };
                const label =
                  item.kind === "task" ? item.task.title : item.event.title;
                const when = timeRange(item.start, item.end);

                if (item.kind === "google") {
                  return (
                    <div
                      key={item.key}
                      title={`${when} ${label} — מגוגל, קריאה בלבד`}
                      className={cn(
                        "absolute z-20 overflow-hidden rounded-md px-1 py-0.5 text-[11px] leading-4",
                        GOOGLE_CHIP,
                      )}
                      style={style}
                    >
                      <div className="flex items-center gap-1 font-medium">
                        <span className="truncate">{label}</span>
                        <Lock className="size-2.5 shrink-0 opacity-60" />
                      </div>
                      <div className="opacity-85">
                        <TimeRange start={item.start} end={item.end} />
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.key}
                    type="button"
                    title={`${when} ${label}`}
                    onClick={() =>
                      item.kind === "task"
                        ? onEditTask(item.task)
                        : onEditEvent(item.event)
                    }
                    className={cn(
                      "absolute z-20 overflow-hidden rounded-md px-1 py-0.5 text-start text-[11px] leading-4 shadow-xs",
                      item.kind === "task"
                        ? cn(
                            "bg-card",
                            item.task.completed
                              ? TASK_CHIP_DONE
                              : TASK_CHIP_OPEN,
                          )
                        : COLOR_STYLES[item.event.color].badge,
                    )}
                    style={style}
                  >
                    <div className="truncate font-medium">{label}</div>
                    {height >= 45 && (
                      <div className="opacity-85">
                        <TimeRange start={item.start} end={item.end} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
