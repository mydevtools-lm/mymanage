"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { he } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
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
import { Hydrated } from "@/components/shared";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { EventDialog } from "@/components/calendar/event-dialog";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { useAppStore } from "@/lib/store";
import { getMonthTransactions, summarize } from "@/lib/finance";
import {
  formatCurrency,
  formatMonth,
  toDateKey,
  todayKey,
  toMonthKey,
} from "@/lib/format";
import { COLOR_STYLES } from "@/lib/colors";
import { useGoogleEvents } from "@/lib/use-google-events";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const transactions = useAppStore((s) => s.transactions);

  const [taskDialog, setTaskDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState(false);
  const [txDialog, setTxDialog] = useState(false);

  const today = todayKey();
  const month = toMonthKey(new Date());

  const dueTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.completed && t.dueDate && t.dueDate <= today)
        .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)),
    [tasks, today],
  );

  const weekEnd = toDateKey(addDays(new Date(), 6));
  const google = useGoogleEvents(today, weekEnd);

  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) =>
      toDateKey(addDays(new Date(), i)),
    );
    return days
      .map((day) => ({
        day,
        events: events
          .filter((e) => e.date === day)
          .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")),
        googleEvents: google.events.filter((e) => e.date === day),
        tasks: tasks.filter((t) => t.dueDate === day && !t.completed),
      }))
      .filter(
        (d) =>
          d.events.length > 0 ||
          d.googleEvents.length > 0 ||
          d.tasks.length > 0,
      );
  }, [events, tasks, google.events]);

  const summary = useMemo(
    () => summarize(getMonthTransactions(transactions, month)),
    [transactions, month],
  );

  const openCount = tasks.filter((t) => !t.completed).length;

  return (
    <>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, d בMMMM yyyy", { locale: he })}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">בוקר טוב, ליאור</h1>
      </div>

      <Hydrated>
        <div className="mb-6 flex flex-wrap gap-2">
          <Button onClick={() => setTaskDialog(true)}>
            <Plus /> משימה
          </Button>
          <Button variant="secondary" onClick={() => setEventDialog(true)}>
            <CalendarDays /> אירוע
          </Button>
          <Button variant="secondary" onClick={() => setTxDialog(true)}>
            <Wallet /> תנועה כספית
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>משימות להיום</CardTitle>
              <CardDescription>
                {dueTasks.length === 0
                  ? `אין משימות שמועדן הגיע · ${openCount} פתוחות בסך הכול`
                  : `${dueTasks.length} משימות שמועדן היום או עבר`}
              </CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/tasks" />}
                >
                  לכל המשימות
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {dueTasks.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-4 text-sm text-accent-foreground">
                  <CheckCircle2 className="size-4" />
                  הכול נקי להיום.
                </div>
              ) : (
                <div className="grid gap-2">
                  {dueTasks.slice(0, 8).map((t) => (
                    <TaskRow key={t.id} task={t} compact />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>מאזן {formatMonth(month)}</CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/finance" />}
                >
                  לכספים
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ArrowUpRight className="size-4 text-income" /> הכנסות
                </span>
                <span className="font-medium tabular-nums text-income">
                  {formatCurrency(summary.income)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ArrowDownLeft className="size-4 text-expense" /> הוצאות
                </span>
                <span className="font-medium tabular-nums text-expense">
                  {formatCurrency(summary.expense)}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="text-xs text-muted-foreground">מאזן</div>
                <div
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    summary.balance >= 0 ? "text-income" : "text-expense",
                  )}
                >
                  {formatCurrency(summary.balance)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>השבוע ביומן</CardTitle>
              <CardDescription>7 הימים הקרובים</CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/calendar" />}
                >
                  ליומן
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {week.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  שבוע פנוי. אין אירועים או משימות מתוזמנות.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {week.map(
                    ({
                      day,
                      events: dayEvents,
                      googleEvents: dayGoogle,
                      tasks: dayTasks,
                    }) => (
                      <div key={day} className="rounded-lg border p-3">
                        <div className="mb-2 text-sm font-semibold">
                          {day === today
                            ? "היום"
                            : format(new Date(day + "T00:00"), "EEEE d/M", {
                                locale: he,
                              })}
                        </div>
                        <div className="grid gap-1">
                          {dayEvents.map((e) => (
                            <div
                              key={e.id}
                              className={cn(
                                "truncate rounded px-1.5 py-0.5 text-xs",
                                COLOR_STYLES[e.color].badge,
                              )}
                            >
                              {e.startTime && !e.allDay && (
                                <span className="me-1 tabular-nums opacity-70">
                                  {e.startTime}
                                </span>
                              )}
                              {e.title}
                            </div>
                          ))}
                          {dayGoogle.map((e) => (
                            <div
                              key={e.id}
                              className="truncate rounded border-s-2 border-s-sky-500 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
                            >
                              {e.startTime && (
                                <span className="me-1 tabular-nums opacity-70">
                                  {e.startTime}
                                </span>
                              )}
                              {e.title}
                            </div>
                          ))}
                          {dayTasks.map((t) => (
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
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Hydrated>

      <TaskDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        defaultDueDate={today}
      />
      <EventDialog open={eventDialog} onOpenChange={setEventDialog} />
      <TransactionDialog open={txDialog} onOpenChange={setTxDialog} />
    </>
  );
}
