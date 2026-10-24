"use client";

import { useMemo } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { useGoogleEvents } from "@/lib/use-google-events";
import { useHolidays } from "@/lib/use-holidays";
import { COLOR_STYLES } from "@/lib/colors";
import { toDateKey, todayKey } from "@/lib/format";
import { dateLocale, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { expandEvents } from "@/lib/event-series";
import { googleChip } from "@/components/calendar/chips";

/** The six days after today — today itself is the main body of the screen. */
export function WeekAheadCard() {
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const today = todayKey();
  const from = toDateKey(addDays(new Date(), 1));
  const to = toDateKey(addDays(new Date(), 6));
  const google = useGoogleEvents(from, to);
  const holidays = useHolidays(from, to);

  const days = useMemo(() => {
    const shown = expandEvents(events, from, to);
    return Array.from({ length: 6 }, (_, i) =>
      toDateKey(addDays(new Date(), i + 1)),
    )
      .map((day) => ({
        day,
        events: shown
          .filter((e) => e.date === day)
          .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")),
        google: [...google.events, ...holidays.events].filter(
          (e) => e.date === day,
        ),
        tasks: tasks.filter((t) => t.dueDate === day && !t.archivedAt),
      }))
      .filter((d) => d.events.length + d.google.length + d.tasks.length > 0);
  }, [events, tasks, google.events, holidays.events, from, to]);

  const { common, today: text } = t();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.weekAhead.title}</CardTitle>
        <CardDescription>{text.weekAhead.description}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/calendar" />}
          >
            {text.weekAhead.openCalendar}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {text.weekAhead.empty}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {days.map((d) => (
              <div key={d.day} className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-semibold">
                  {d.day === today
                    ? common.today
                    : format(new Date(d.day + "T00:00"), "EEEE d/M", {
                        locale: dateLocale(),
                      })}
                </div>
                <div className="grid gap-1">
                  {d.events.map((e) => (
                    <div
                      key={e.id}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-xs",
                        COLOR_STYLES[e.color].badge,
                      )}
                    >
                      {e.startTime && !e.allDay && (
                        <span className="me-1 tabular-nums">{e.startTime}</span>
                      )}
                      {e.title}
                    </div>
                  ))}
                  {d.google.map((e) => (
                    <div
                      key={e.id}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-xs",
                        googleChip(e.color),
                      )}
                    >
                      {e.startTime && (
                        <span className="me-1 tabular-nums">{e.startTime}</span>
                      )}
                      {e.title}
                    </div>
                  ))}
                  {d.tasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-1.5 truncate px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      <CheckSquare className="size-3 shrink-0" />
                      {t.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
