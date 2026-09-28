"use client";

import { format, isSameMonth } from "date-fns";
import { COLOR_STYLES } from "@/lib/colors";
import { toDateKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayData } from "./use-calendar-data";
import { GOOGLE_CHIP, TASK_CHIP_DONE, TASK_CHIP_OPEN } from "./chips";

export const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const PER_CELL = 3;

/** Classic month grid. Each chip shows its time; overflow becomes "+N". */
export function MonthView({
  days,
  month,
  day,
  onSelectDay,
}: {
  days: Date[];
  month: Date;
  day: (key: string) => DayData;
  onSelectDay: (key: string) => void;
}) {
  const today = todayKey();

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
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
            })),
            ...google.map((e) => ({
              key: e.id,
              time: e.startTime,
              title: e.title,
              className: GOOGLE_CHIP,
              dot: "bg-sky-500",
            })),
            ...tasks.map((t) => ({
              key: t.id,
              time: t.dueTime,
              title: t.title,
              className: t.completed ? TASK_CHIP_DONE : TASK_CHIP_OPEN,
              dot: t.completed ? "bg-muted-foreground/40" : "bg-primary",
            })),
          ];
          const shown = chips.slice(0, PER_CELL);
          const more = chips.length - shown.length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-label={`${format(date, "d.M")} — ${chips.length} פריטים`}
              className={cn(
                "flex min-h-20 flex-col items-stretch gap-1 border-b border-e p-1 text-start transition-colors nth-[7n]:border-e-0 can-hover:hover:bg-accent/40 md:min-h-28 md:p-1.5",
                !inMonth && "bg-muted/30 text-muted-foreground",
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
                    className={cn(
                      "flex min-w-0 items-baseline gap-1 rounded px-1 text-[11px] leading-5",
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
                    +{more} נוספים
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
