"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CalendarDays, CheckCircle2, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Hydrated, PageHeader } from "@/components/shared";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { EventDialog } from "@/components/calendar/event-dialog";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { DayPicker } from "@/components/today/day-picker";
import { DayTaskRow } from "@/components/today/day-task-row";
import { MonthBalanceCard } from "@/components/today/month-balance-card";
import { WeekAheadCard } from "@/components/today/week-ahead-card";
import { useAppStore } from "@/lib/store";
import { formatDate, todayKey } from "@/lib/format";
import { greeting } from "@/lib/greeting";

/**
 * Home screen. Replaces both the old dashboard and the old "daily tasks"
 * page, which showed the same day's work in two places by different rules.
 */
export default function TodayPage() {
  const tasks = useAppStore((s) => s.tasks);
  const [date, setDate] = useState(todayKey());
  const [taskDialog, setTaskDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState(false);
  const [txDialog, setTxDialog] = useState(false);

  const today = todayKey();
  const isToday = date === today;

  const { dayTasks, carriedOver } = useMemo(() => {
    const active = tasks.filter((t) => !t.archivedAt);
    return {
      dayTasks: active.filter((t) => t.dueDate === date),
      // Only on today: unfinished work whose date has already passed.
      carriedOver: isToday
        ? active.filter((t) => t.dueDate && t.dueDate < today)
        : [],
    };
  }, [tasks, date, today, isToday]);

  const doneOnDay = tasks.filter(
    (t) => t.archivedAt && (t.completedAt ?? "").slice(0, 10) === date,
  ).length;

  return (
    <>
      <PageHeader
        title="היום"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setTaskDialog(true)}>
              <Plus /> משימה
            </Button>
            <Button variant="secondary" onClick={() => setEventDialog(true)}>
              <CalendarDays /> אירוע
            </Button>
            <Button variant="secondary" onClick={() => setTxDialog(true)}>
              <Wallet /> תנועה
            </Button>
          </div>
        }
      />

      <Hydrated>
        {/* Rendered only on the client: a static page is built ahead of time,
            so a greeting computed at build time would be wrong by morning. */}
        <p className="-mt-4 mb-5 text-sm text-muted-foreground">
          {greeting()}, ליאור ·{" "}
          {format(new Date(), "EEEE, d בMMMM yyyy", { locale: he })}
        </p>

        <div className="grid gap-4">
          <DayPicker date={date} onChange={setDate} />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {isToday
                      ? "המשימות של היום"
                      : `משימות ל־${formatDate(date)}`}
                  </CardTitle>
                  <CardDescription>
                    {dayTasks.length === 0
                      ? "אין משימות פתוחות ליום זה"
                      : `${dayTasks.length} פתוחות`}
                    {doneOnDay > 0 && ` · ${doneOnDay} הושלמו`}
                  </CardDescription>
                </div>
                {dayTasks.length === 0 && doneOnDay > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-income">
                    <CheckCircle2 className="size-4" /> הכול בוצע
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {dayTasks.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  שום משימה לא מתוזמנת ליום הזה.
                </p>
              ) : (
                dayTasks.map((task) => <DayTaskRow key={task.id} task={task} />)
              )}
            </CardContent>
          </Card>

          {carriedOver.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-destructive">
                  נגררו מימים קודמים
                </CardTitle>
                <CardDescription>
                  {carriedOver.length} משימות שמועדן עבר ולא סומנו
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {carriedOver.map((task) => (
                  <div key={task.id} className="grid gap-1">
                    <DayTaskRow task={task} />
                    <span className="-mt-0.5 px-3 text-xs text-muted-foreground">
                      מועד מקורי: {formatDate(task.dueDate!)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <WeekAheadCard />
            <MonthBalanceCard />
          </div>
        </div>
      </Hydrated>

      <TaskDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        defaultDueDate={date}
      />
      <EventDialog
        open={eventDialog}
        onOpenChange={setEventDialog}
        defaultDate={date}
      />
      <TransactionDialog open={txDialog} onOpenChange={setTxDialog} />
    </>
  );
}
