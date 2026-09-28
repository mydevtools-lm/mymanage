"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Plus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Hydrated, PageHeader } from "@/components/shared";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { SortableList } from "@/components/sortable-list";
import { TaskRow } from "@/components/tasks/task-row";
import { EventDialog } from "@/components/calendar/event-dialog";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { DayPicker } from "@/components/today/day-picker";
import { AllDayStrip, DayTimeline } from "@/components/today/day-timeline";
import { DaySwipe } from "@/components/today/day-swipe";
import { MonthBalanceCard } from "@/components/today/month-balance-card";
import { WeekAheadCard } from "@/components/today/week-ahead-card";
import { useAppStore } from "@/lib/store";
import { useGoogleEvents } from "@/lib/use-google-events";
import { buildDayAgenda, dayProgress } from "@/lib/agenda";
import { formatDate, toDateKey, todayKey } from "@/lib/format";
import { greeting } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { expandEvents } from "@/lib/event-series";
import type { CalendarEvent, Task } from "@/lib/types";

/**
 * Home screen: the selected day's appointments and tasks in one place, with
 * what was left over from earlier days and what has no date at all.
 */
export default function TodayPage() {
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const updateTask = useAppStore((s) => s.updateTask);
  const reorderTasks = useAppStore((s) => s.reorderTasks);

  const [date, setDate] = useState(todayKey());
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [eventDialog, setEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [txDialog, setTxDialog] = useState(false);
  const [showUndated, setShowUndated] = useState(false);

  const today = todayKey();
  const isToday = date === today;
  const google = useGoogleEvents(date, date);

  const agenda = useMemo(
    () =>
      buildDayAgenda({
        date,
        today,
        tasks,
        events: expandEvents(events, date, date),
        googleEvents: google.events,
      }),
    [date, today, tasks, events, google.events],
  );
  const progress = dayProgress(agenda);

  const editTask = (task: Task) => {
    setEditingTask(task);
    setTaskDialog(true);
  };
  const editEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventDialog(true);
  };
  const shiftDay = (delta: number) =>
    setDate((d) => toDateKey(addDays(parseISO(d), delta)));
  const moveToToday = (task: Task) => updateTask(task.id, { dueDate: today });

  const nothingPlanned =
    agenda.allDay.length === 0 &&
    agenda.timeline.length === 0 &&
    agenda.untimedTasks.length === 0;

  return (
    <>
      <PageHeader
        title="היום"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setEditingTask(null);
                setTaskDialog(true);
              }}
            >
              <Plus /> משימה
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingEvent(null);
                setEventDialog(true);
              }}
            >
              <CalendarDays /> אירוע
            </Button>
            <Button variant="secondary" onClick={() => setTxDialog(true)}>
              <Wallet /> תנועה
            </Button>
          </div>
        }
      />

      <Hydrated>
        {/* Client-only: a static page is built ahead of time, and a greeting
            baked in at build time would be wrong by morning. */}
        <p className="-mt-4 mb-5 text-sm text-muted-foreground">
          {greeting()}, ליאור ·{" "}
          {format(new Date(), "EEEE, d בMMMM yyyy", { locale: he })}
        </p>

        <DaySwipe onNext={() => shiftDay(1)} onPrevious={() => shiftDay(-1)}>
          <div className="grid gap-4">
            <DayPicker date={date} onChange={setDate} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {isToday ? "מה יש היום" : `מה יש ב־${formatDate(date)}`}
                </CardTitle>
                <CardDescription>
                  {progress.total === 0
                    ? "אין משימות ליום הזה"
                    : `${progress.done} מתוך ${progress.total} משימות בוצעו`}
                </CardDescription>
                {progress.total > 0 && progress.done === progress.total && (
                  <CardAction>
                    <span className="flex items-center gap-1.5 text-sm text-income">
                      <CheckCircle2 className="size-4" /> הכול בוצע
                    </span>
                  </CardAction>
                )}
                {progress.total > 0 && (
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.done}
                    aria-label="התקדמות היום"
                    className="col-span-full mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-income transition-all"
                      style={{ width: `${progress.ratio * 100}%` }}
                    />
                  </div>
                )}
              </CardHeader>

              <CardContent className="grid gap-4">
                <AllDayStrip items={agenda.allDay} onEditEvent={editEvent} />

                <DayTimeline
                  items={agenda.timeline}
                  isToday={isToday}
                  onEditEvent={editEvent}
                  onEditTask={editTask}
                />

                {agenda.untimedTasks.length > 0 && (
                  <div className="grid gap-2">
                    {agenda.timeline.length > 0 && (
                      <h3 className="text-sm font-medium text-muted-foreground">
                        במהלך היום
                      </h3>
                    )}
                    {agenda.untimedTasks.length > 1 ? (
                      <SortableList
                        items={agenda.untimedTasks}
                        onReorder={reorderTasks}
                        handleLabel="גרירה לשינוי סדר המשימות"
                        renderItem={(task, handle) => (
                          <TaskRow
                            task={task}
                            onEdit={editTask}
                            hideDate
                            handle={handle}
                          />
                        )}
                      />
                    ) : (
                      agenda.untimedTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onEdit={editTask}
                          hideDate
                        />
                      ))
                    )}
                  </div>
                )}

                {nothingPlanned && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {agenda.doneCount > 0
                      ? "כל מה שתוכנן ליום הזה בוצע."
                      : "שום דבר לא מתוזמן ליום הזה."}
                  </p>
                )}
              </CardContent>
            </Card>

            {agenda.carriedOver.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-destructive">
                    נגררו מימים קודמים
                  </CardTitle>
                  <CardDescription>
                    {agenda.carriedOver.length} משימות שמועדן עבר ולא סומנו
                  </CardDescription>
                  <CardAction>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => agenda.carriedOver.forEach(moveToToday)}
                    >
                      <CalendarPlus /> הכול להיום
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {agenda.carriedOver.map((task) => (
                    <div key={task.id} className="grid gap-1">
                      <TaskRow
                        task={task}
                        onEdit={editTask}
                        hideDate
                        trailing={
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveToToday(task)}
                          >
                            להיום
                          </Button>
                        }
                      />
                      <span className="-mt-0.5 px-3 text-xs text-muted-foreground">
                        מועד מקורי: {formatDate(task.dueDate!)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {agenda.undated.length > 0 && (
              <Card>
                <button
                  type="button"
                  onClick={() => setShowUndated((v) => !v)}
                  aria-expanded={showUndated}
                  className="flex items-center gap-2 px-4 text-start"
                >
                  <Inbox className="size-4 text-muted-foreground" />
                  <span className="font-medium">בלי תאריך</span>
                  <span className="text-sm text-muted-foreground">
                    ({agenda.undated.length})
                  </span>
                  <ChevronDown
                    className={cn(
                      "ms-auto size-4 text-muted-foreground transition-transform",
                      showUndated && "rotate-180",
                    )}
                  />
                </button>
                {showUndated && (
                  <CardContent className="grid gap-2">
                    {agenda.undated.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onEdit={editTask}
                        trailing={
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveToToday(task)}
                          >
                            להיום
                          </Button>
                        }
                      />
                    ))}
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        </DaySwipe>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <WeekAheadCard />
          <MonthBalanceCard />
        </div>
      </Hydrated>

      <TaskDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        task={editingTask}
        defaultDueDate={date}
      />
      <EventDialog
        open={eventDialog}
        onOpenChange={setEventDialog}
        event={editingEvent}
        defaultDate={date}
      />
      <TransactionDialog open={txDialog} onOpenChange={setTxDialog} />
    </>
  );
}
