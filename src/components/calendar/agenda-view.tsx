"use client";

import { format } from "date-fns";
import { CalendarX2, Lock, MapPin, Repeat } from "lucide-react";
import { COLOR_STYLES } from "@/lib/colors";
import { toDateKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dateLocale, t } from "@/lib/i18n";
import type { CalendarEvent, Task } from "@/lib/types";
import { TaskRow } from "@/components/tasks/task-row";
import { TimeRange } from "@/components/time-range";
import type { DayData } from "./use-calendar-data";
import { googleChip, googleTint } from "./chips";

/**
 * Days in sequence with what is on each — the natural way to read a calendar
 * on a phone. Empty days are skipped, except today, which is always shown so
 * the reader knows where they are.
 */
export function AgendaView({
  days,
  day,
  onSelectDay,
  onEditEvent,
  onEditTask,
}: {
  days: Date[];
  day: (key: string) => DayData;
  onSelectDay: (key: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
}) {
  const today = todayKey();
  const m = t().calendar;
  const locale = dateLocale();
  const rows = days
    .map((date) => ({ date, key: toDateKey(date), data: day(toDateKey(date)) }))
    .filter(
      ({ key, data }) =>
        key === today ||
        data.events.length + data.google.length + data.tasks.length > 0,
    );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
        <CalendarX2 className="size-8 opacity-60" />
        <p className="font-medium text-foreground">{m.agenda.emptyTitle}</p>
        <p className="text-sm">{m.agenda.emptyHint}</p>
      </div>
    );
  }

  return (
    <ol className="grid gap-4">
      {rows.map(({ date, key, data }) => {
        const allDay = [
          ...data.events.filter((e) => e.allDay || !e.startTime),
          ...data.google.filter((e) => e.allDay || !e.startTime),
        ];
        const timed = [
          ...data.events
            .filter((e) => !e.allDay && e.startTime)
            .map((e) => ({ time: e.startTime!, kind: "event" as const, e })),
          ...data.google
            .filter((e) => !e.allDay && e.startTime)
            .map((e) => ({ time: e.startTime!, kind: "google" as const, e })),
        ].sort((a, b) => a.time.localeCompare(b.time));
        const empty = allDay.length + timed.length + data.tasks.length === 0;

        return (
          <li key={key} className="grid grid-cols-[3.25rem_1fr] gap-3">
            <button
              type="button"
              onClick={() => onSelectDay(key)}
              className="flex flex-col items-center self-start rounded-lg py-1 transition-colors can-hover:hover:bg-accent/50"
            >
              <span className="text-xs text-muted-foreground">
                {format(date, "EEE", { locale })}
              </span>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-lg font-semibold",
                  key === today && "bg-primary text-primary-foreground",
                )}
              >
                {format(date, "d")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {format(date, "MMM", { locale })}
              </span>
            </button>

            <div className="grid min-w-0 content-start gap-2 border-b pb-4">
              {empty && (
                <p className="py-2 text-sm text-muted-foreground">
                  {m.agenda.dayFree}
                </p>
              )}

              {allDay.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allDay.map((e) =>
                    "source" in e ? (
                      <span
                        key={e.id}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-sm",
                          googleChip(e.color),
                        )}
                      >
                        {e.title}
                      </span>
                    ) : (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onEditEvent(e)}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-sm",
                          COLOR_STYLES[e.color].badge,
                        )}
                      >
                        {e.title}
                      </button>
                    ),
                  )}
                </div>
              )}

              {timed.map((item) =>
                item.kind === "google" ? (
                  <div
                    key={item.e.id}
                    className={cn(
                      "rounded-lg border border-s-4 px-3 py-2",
                      googleTint(item.e.color).bar,
                      googleTint(item.e.color).card,
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {item.e.title}
                      <Lock className="size-3 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      <TimeRange
                        start={item.e.startTime}
                        end={item.e.endTime}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    key={item.e.id}
                    type="button"
                    onClick={() => onEditEvent(item.e)}
                    className={cn(
                      "rounded-lg border border-s-4 px-3 py-2 text-start",
                      COLOR_STYLES[item.e.color].soft,
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      {item.e.title}
                      {item.e.repeat && (
                        <Repeat
                          className="size-3.5 text-muted-foreground"
                          aria-label={m.recurringEvent}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        <TimeRange
                          start={item.e.startTime}
                          end={item.e.endTime}
                        />
                      </span>
                      {item.e.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {item.e.location}
                        </span>
                      )}
                    </div>
                  </button>
                ),
              )}

              {data.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onEdit={onEditTask}
                  hideDate
                  compact
                />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
