"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hydrated, PageHeader } from "@/components/shared";
import { EventDialog } from "@/components/calendar/event-dialog";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { AgendaView } from "@/components/calendar/agenda-view";
import { DayPanel } from "@/components/calendar/day-panel";
import { useCalendarData } from "@/components/calendar/use-calendar-data";
import { useEventActions } from "@/components/calendar/event-actions";
import { googleChip } from "@/components/calendar/chips";
import { useAppStore } from "@/lib/store";
import { toDateKey } from "@/lib/format";
import { useIsDesktop } from "@/lib/use-media";
import { cn } from "@/lib/utils";
import { dateLocale, t } from "@/lib/i18n";
import type { CalendarEvent, Task } from "@/lib/types";

type View = "month" | "week" | "list";
const VIEW_KEY = "calendar-view";
const LIST_DAYS = 30;

function readStoredView(): View | null {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "month" || v === "week" || v === "list" ? v : null;
  } catch {
    return null;
  }
}

function rangeFor(view: View, cursor: Date, weekStartsOn: 0 | 1 | 6) {
  if (view === "month") {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn });
    return eachDayOfInterval({ start, end });
  }
  if (view === "week") {
    const start = startOfWeek(cursor, { weekStartsOn });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }
  return eachDayOfInterval({
    start: cursor,
    end: addDays(cursor, LIST_DAYS - 1),
  });
}

function labelFor(view: View, days: Date[], cursor: Date) {
  const locale = dateLocale();
  const { dates } = t().common;
  if (view === "month") return format(cursor, "MMMM yyyy", { locale });
  const first = days[0];
  const last = days[days.length - 1];
  const sameYear = first.getFullYear() === last.getFullYear();
  return `${format(first, sameYear ? dates.dayMonth : dates.short, {
    locale,
  })} – ${format(last, dates.short, { locale })}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function CalendarPage() {
  const isDesktop = useIsDesktop();
  // The views render only after the store hydrates (<Hydrated>), so reading
  // localStorage here cannot cause a server/client mismatch.
  const [view, setView] = useState<View | null>(() =>
    typeof window === "undefined" ? null : readStoredView(),
  );
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [eventDialog, setEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [slot, setSlot] = useState<{ date: string; hour: number } | null>(null);
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // First visit: a list on phones, a month grid on desktop. After that, the
  // last choice sticks.
  const current: View = view ?? (isDesktop ? "month" : "list");
  const weekStart = useAppStore((s) => s.settings.prefs?.weekStart ?? 0);
  const days = useMemo(
    () => rangeFor(current, cursor, weekStart),
    [current, cursor, weekStart],
  );
  const from = toDateKey(days[0]);
  const to = toDateKey(days[days.length - 1]);
  const { day, google } = useCalendarData(from, to);

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  };

  const shift = (direction: 1 | -1) =>
    setCursor((c) =>
      current === "month"
        ? addMonths(startOfMonth(c), direction)
        : addDays(c, direction * (current === "week" ? 7 : LIST_DAYS)),
    );

  const openNewEvent = (preset?: { date: string; hour: number }) => {
    setEditingEvent(null);
    setSlot(preset ?? null);
    setEventDialog(true);
  };
  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSlot(null);
    setEventDialog(true);
  };
  // Dragging in the month or week grid: a new day, and in the week a new time.
  const { save: saveEvent } = useEventActions();
  const updateTask = useAppStore((s) => s.updateTask);
  const moveEvent = (
    event: CalendarEvent,
    date: string,
    startTime?: string,
    endTime?: string,
  ) =>
    void saveEvent(event, startTime ? { date, startTime, endTime } : { date });
  const moveTask = (task: Task, date: string, dueTime?: string) =>
    updateTask(
      task.id,
      dueTime ? { dueDate: date, dueTime } : { dueDate: date },
    );

  const openNewTask = () => {
    setEditingTask(null);
    setTaskDialog(true);
  };
  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskDialog(true);
  };

  const m = t().calendar;

  return (
    <>
      <PageHeader
        title={m.title}
        actions={
          <Button onClick={() => openNewEvent()}>
            <Plus />
            {m.newEvent}
          </Button>
        }
      />

      <Hydrated>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={m.previous}
            onClick={() => shift(-1)}
          >
            <ChevronRight className="ltr:rotate-180" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={m.next}
            onClick={() => shift(1)}
          >
            <ChevronLeft className="ltr:rotate-180" />
          </Button>
          <Button variant="ghost" onClick={() => setCursor(new Date())}>
            {t().common.today}
          </Button>
          <h2 className="ms-1 text-lg font-semibold">
            {labelFor(current, days, cursor)}
          </h2>

          <Tabs
            className="ms-auto"
            value={current}
            onValueChange={(v) => changeView(v as View)}
          >
            <TabsList>
              <TabsTrigger value="month" aria-label={m.viewMonth}>
                <LayoutGrid />
                <span className="max-sm:sr-only">{m.month}</span>
              </TabsTrigger>
              <TabsTrigger value="week" aria-label={m.viewWeek}>
                <CalendarDays />
                <span className="max-sm:sr-only">{m.week}</span>
              </TabsTrigger>
              <TabsTrigger value="list" aria-label={m.viewList}>
                <List />
                <span className="max-sm:sr-only">{m.list}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {current === "month" && (
          <MonthView
            days={days}
            month={cursor}
            day={day}
            onSelectDay={setSelectedDay}
            onMoveEvent={moveEvent}
            onMoveTask={moveTask}
          />
        )}
        {current === "week" && (
          <WeekView
            days={days}
            day={day}
            onSelectDay={setSelectedDay}
            onEditEvent={openEditEvent}
            onEditTask={openEditTask}
            onCreateAt={(date, hour) => openNewEvent({ date, hour })}
            onMoveEvent={moveEvent}
            onMoveTask={moveTask}
          />
        )}
        {current === "list" && (
          <AgendaView
            days={days}
            day={day}
            onSelectDay={setSelectedDay}
            onEditEvent={openEditEvent}
            onEditTask={openEditTask}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-teal-100 dark:bg-teal-900/50" />
            {m.legend.event}
          </span>
          {google.calendars
            .filter((c) => !c.hidden && !c.failed)
            .map((c) => (
              <span key={c.id} className="flex items-center gap-1.5">
                <span className={cn("size-3 rounded", googleChip(c.color))} />
                {c.name}
              </span>
            ))}
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-dashed border-primary/40" />
            {m.legend.task}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="line-through">{m.legend.task}</span>{" "}
            {m.legend.taskDone}
          </span>

          <span className="ms-auto">
            {google.error ? (
              <span className="text-destructive">{google.error}</span>
            ) : !google.configured ? (
              <Link
                href="/settings?tab=connections"
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {m.google.notConnected}
              </Link>
            ) : google.loading ? (
              m.google.loading
            ) : (
              m.google.count(google.events.length)
            )}
          </span>
        </div>
      </Hydrated>

      <DayPanel
        dayKey={selectedDay}
        data={
          selectedDay ? day(selectedDay) : { events: [], google: [], tasks: [] }
        }
        onClose={() => setSelectedDay(null)}
        onNewEvent={() =>
          openNewEvent(
            selectedDay ? { date: selectedDay, hour: -1 } : undefined,
          )
        }
        onEditEvent={openEditEvent}
        onNewTask={openNewTask}
        onEditTask={openEditTask}
      />

      <EventDialog
        open={eventDialog}
        onOpenChange={setEventDialog}
        event={editingEvent}
        defaultDate={slot?.date ?? selectedDay ?? undefined}
        defaultStartTime={
          slot && slot.hour >= 0 ? `${pad(slot.hour)}:00` : undefined
        }
        defaultEndTime={
          slot && slot.hour >= 0 && slot.hour < 23
            ? `${pad(slot.hour + 1)}:00`
            : undefined
        }
      />
      <TaskDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        task={editingTask}
        defaultDueDate={selectedDay ?? undefined}
      />
    </>
  );
}
