"use client";

import { useRef, useState } from "react";
import { format, isSameMonth } from "date-fns";
import { COLOR_STYLES } from "@/lib/colors";
import { toDateKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dateLocale, t } from "@/lib/i18n";
import type { CalendarEvent, Task } from "@/lib/types";
import type { DayData } from "./use-calendar-data";
import {
  googleChip,
  googleTint,
  TASK_CHIP_DONE,
  TASK_CHIP_OPEN,
} from "./chips";

const PER_CELL = 3;

type Dragged =
  { kind: "event"; event: CalendarEvent } | { kind: "task"; task: Task };

/**
 * Classic month grid. Each chip shows its time; overflow becomes "+N".
 * On a computer, an event or task chip can be dragged to another day.
 */
export function MonthView({
  days,
  month,
  day,
  onSelectDay,
  onMoveEvent,
  onMoveTask,
}: {
  days: Date[];
  month: Date;
  day: (key: string) => DayData;
  onSelectDay: (key: string) => void;
  onMoveEvent?: (event: CalendarEvent, date: string) => void;
  onMoveTask?: (task: Task, date: string) => void;
}) {
  const today = todayKey();
  const dragged = useRef<Dragged | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const m = t().calendar;
  const locale = dateLocale();

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {/* Headers follow the grid: the first column is its first day. */}
        {days.slice(0, 7).map((date) => (
          <div key={date.getDay()} className="py-2">
            {format(date, "EEEEEE", { locale })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const key = toDateKey(date);
          const inMonth = isSameMonth(date, month);
          const { events, google, tasks } = day(key);

          // One list in display order: appointments first, then tasks.
          const chips = [
            ...events.map((e) => ({
              key: e.id,
              time: e.allDay ? undefined : e.startTime,
              title: e.title,
              className: COLOR_STYLES[e.color].badge,
              dot: COLOR_STYLES[e.color].dot,
              drag: onMoveEvent
                ? ({ kind: "event", event: e } as Dragged)
                : undefined,
            })),
            ...google.map((e) => ({
              key: e.id,
              time: e.startTime,
              title: e.title,
              className: googleChip(e.color),
              dot: googleTint(e.color).dot,
              drag: undefined,
            })),
            ...tasks.map((t) => ({
              key: t.id,
              time: t.dueTime,
              title: t.title,
              className: t.completed ? TASK_CHIP_DONE : TASK_CHIP_OPEN,
              dot: t.completed ? "bg-muted-foreground/40" : "bg-primary",
              drag: onMoveTask
                ? ({ kind: "task", task: t } as Dragged)
                : undefined,
            })),
          ];
          const shown = chips.slice(0, PER_CELL);
          const more = chips.length - shown.length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              onDragOver={(e) => {
                if (!dragged.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== key) setOver(key);
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const item = dragged.current;
                dragged.current = null;
                setOver(null);
                if (!item) return;
                if (item.kind === "event") {
                  if (item.event.date !== key) onMoveEvent?.(item.event, key);
                } else if (item.task.dueDate !== key) {
                  onMoveTask?.(item.task, key);
                }
              }}
              aria-label={m.monthView.cellLabel(
                format(date, m.dates.cell, { locale }),
                chips.length,
              )}
              className={cn(
                "flex min-h-20 flex-col items-stretch gap-1 border-b border-e p-1 text-start transition-colors nth-[7n]:border-e-0 can-hover:hover:bg-accent/40 md:min-h-28 md:p-1.5",
                !inMonth && "bg-muted/30 text-muted-foreground",
                over === key && "bg-accent ring-2 ring-primary ring-inset",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs",
                  key === today &&
                    "bg-primary font-bold text-primary-foreground",
                )}
              >
                {format(date, "d")}
              </span>

              {/* Phones: a dot per item — the day panel has the details. */}
              {chips.length > 0 && (
                <span className="flex flex-wrap gap-0.5 px-0.5 md:hidden">
                  {chips.slice(0, 4).map((c) => (
                    <span
                      key={c.key}
                      className={cn("size-1.5 rounded-full", c.dot)}
                    />
                  ))}
                </span>
              )}

              <div className="hidden flex-col gap-0.5 md:flex">
                {shown.map((c) => (
                  <span
                    key={c.key}
                    title={c.time ? `${c.time} ${c.title}` : c.title}
                    draggable={!!c.drag}
                    onDragStart={(e) => {
                      if (!c.drag) return;
                      dragged.current = c.drag;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", c.title);
                    }}
                    onDragEnd={() => {
                      dragged.current = null;
                      setOver(null);
                    }}
                    className={cn(
                      "flex min-w-0 items-baseline gap-1 rounded px-1 text-[11px] leading-5",
                      c.drag && "cursor-grab active:cursor-grabbing",
                      c.className,
                    )}
                  >
                    {c.time && (
                      <span className="shrink-0 tabular-nums opacity-85">
                        {c.time}
                      </span>
                    )}
                    <span className="truncate">{c.title}</span>
                  </span>
                ))}
                {more > 0 && (
                  <span className="px-1 text-[11px] font-medium text-primary">
                    {m.monthView.more(more)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
