"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { he } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Hydrated, PageHeader } from "@/components/shared";
import { EventDialog } from "@/components/calendar/event-dialog";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { useAppStore } from "@/lib/store";
import { COLOR_STYLES } from "@/lib/colors";
import { toDateKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/types";

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function eventTime(e: CalendarEvent) {
  if (e.allDay || !e.startTime) return "";
  return e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime;
}

export default function CalendarPage() {
  const events = useAppStore((s) => s.events);
  const tasks = useAppStore((s) => s.tasks);
  const deleteEvent = useAppStore((s) => s.deleteEvent);

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [eventDialog, setEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [taskDialog, setTaskDialog] = useState(false);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }
    return map;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [tasks]);

  const today = todayKey();
  const dayEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];
  const dayTasks = selectedDay ? (tasksByDay.get(selectedDay) ?? []) : [];

  return (
    <>
      <PageHeader
        title="יומן"
        actions={
          <Button
            onClick={() => {
              setEditingEvent(null);
              setEventDialog(true);
            }}
          >
            <Plus />
            אירוע חדש
          </Button>
        }
      />

      <Hydrated>
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="חודש קודם"
            onClick={() => setCursor((c) => addMonths(c, -1))}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="חודש הבא"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            היום
          </Button>
          <h2 className="ms-2 text-lg font-semibold">
            {format(cursor, "MMMM yyyy", { locale: he })}
          </h2>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = toDateKey(day);
              const inMonth = isSameMonth(day, cursor);
              const dayEv = eventsByDay.get(key) ?? [];
              const dayTk = tasksByDay.get(key) ?? [];
              const items = dayEv.length + dayTk.length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    "flex min-h-24 flex-col items-stretch gap-1 border-b border-e p-1.5 text-start transition-colors hover:bg-accent/40",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    "nth-[7n]:border-e-0",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs",
                      key === today &&
                        "bg-primary font-bold text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayEv.slice(0, 2).map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          "truncate rounded px-1 text-[11px] leading-5",
                          COLOR_STYLES[e.color].badge,
                        )}
                      >
                        {e.startTime && !e.allDay && (
                          <span className="me-1 tabular-nums opacity-70">
                            {e.startTime}
                          </span>
                        )}
                        {e.title}
                      </span>
                    ))}
                    {dayTk
                      .slice(0, Math.max(0, 3 - Math.min(dayEv.length, 2)))
                      .map((t) => (
                        <span
                          key={t.id}
                          className={cn(
                            "truncate rounded border border-dashed px-1 text-[11px] leading-5",
                            t.completed
                              ? "text-muted-foreground line-through"
                              : "border-primary/40 text-foreground",
                          )}
                        >
                          {t.title}
                        </span>
                      ))}
                    {items > 3 && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{items - 3} נוספים
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-teal-100 dark:bg-teal-900/50" />{" "}
            אירוע
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-dashed border-primary/40" />{" "}
            משימה
          </span>
          <span className="flex items-center gap-1.5">
            <span className="line-through">משימה</span> הושלמה
          </span>
        </div>
      </Hydrated>

      <Sheet
        open={!!selectedDay}
        onOpenChange={(o) => !o && setSelectedDay(null)}
      >
        <SheetContent side="left" className="w-full sm:max-w-md">
          {selectedDay && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {format(
                    new Date(selectedDay + "T00:00"),
                    "EEEE, d בMMMM yyyy",
                    {
                      locale: he,
                    },
                  )}
                </SheetTitle>
                <SheetDescription>
                  {dayEvents.length} אירועים · {dayTasks.length} משימות
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
                <section className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">אירועים</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingEvent(null);
                        setEventDialog(true);
                      }}
                    >
                      <Plus /> אירוע
                    </Button>
                  </div>
                  {dayEvents.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      אין אירועים ביום זה.
                    </p>
                  )}
                  {dayEvents.map((e) => (
                    <div
                      key={e.id}
                      className={cn(
                        "group flex items-start gap-3 rounded-lg border p-3",
                        COLOR_STYLES[e.color].soft,
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{e.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.allDay ? "כל היום" : eventTime(e) || "ללא שעה"}
                        </div>
                        {e.location && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3" /> {e.location}
                          </div>
                        )}
                        {e.notes && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {e.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="עריכה"
                          onClick={() => {
                            setEditingEvent(e);
                            setEventDialog(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label="מחיקה"
                          onClick={() => deleteEvent(e.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">משימות</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTaskDialog(true)}
                    >
                      <Plus /> משימה
                    </Button>
                  </div>
                  {dayTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      אין משימות ליום זה.
                    </p>
                  )}
                  {dayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} compact />
                  ))}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <EventDialog
        open={eventDialog}
        onOpenChange={setEventDialog}
        event={editingEvent}
        defaultDate={selectedDay ?? undefined}
      />
      <TaskDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        defaultDueDate={selectedDay ?? undefined}
      />

      {events.length === 0 && tasks.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          לחץ על יום כדי להוסיף אירוע או משימה.
        </p>
      )}
    </>
  );
}
