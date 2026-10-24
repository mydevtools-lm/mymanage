"use client";

import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import {
  CalendarDays,
  CheckSquare,
  History,
  Lock,
  Receipt,
  Scale,
  Sunrise,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { useDevicePrefs } from "@/lib/device-prefs";
import { useGoogleEvents } from "@/lib/use-google-events";
import { useHolidays } from "@/lib/use-holidays";
import { morningBrief, weekSummary } from "@/lib/brief";
import { formatCurrency, formatDate, todayKey } from "@/lib/format";
import { greeting } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

type View = "day" | "week";

interface BriefState {
  view: View | null;
  open: (view?: View) => void;
  close: () => void;
}

export const useBrief = create<BriefState>()((set) => ({
  view: null,
  open: (view = "day") => set({ view }),
  close: () => set({ view: null }),
}));

// The brief opens by itself on the first visit of the day, from this hour.
const AUTO_FROM_HOUR = 5;
const FRIDAY = 5;

function Section({
  icon: Icon,
  title,
  children,
  empty,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="grid gap-1.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </h3>
      {empty ? (
        <p className="text-sm text-muted-foreground">
          {t().today.briefDialog.none}
        </p>
      ) : (
        <ul className="grid gap-1 text-sm">{children}</ul>
      )}
    </section>
  );
}

function DayBrief() {
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const transactions = useAppStore((s) => s.transactions);
  const today = todayKey();
  const brief = useMemo(
    () => morningBrief({ tasks, events, transactions }, today),
    [tasks, events, transactions, today],
  );
  // Today's Google events belong in the day too, in time order.
  const google = useGoogleEvents(today, today);
  const holidays = useHolidays(today, today);
  const dayEvents = useMemo(
    () =>
      [
        ...brief.events.map((e) => ({ ...e, google: false })),
        ...holidays.events.map((e) => ({ ...e, google: false })),
        ...google.events.map((e) => ({ ...e, google: true })),
      ].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")),
    [brief.events, holidays.events, google.events],
  );
  const { common, today: area } = t();
  const text = area.briefDialog;
  const money = area.month;

  return (
    <div className="grid gap-4">
      <Section
        icon={CalendarDays}
        title={text.eventsToday}
        empty={!dayEvents.length}
      >
        {dayEvents.map((e) => (
          <li key={e.id} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
              {e.allDay || !e.startTime ? text.allDay : e.startTime}
            </span>
            {e.title}
            {e.google && (
              <Lock
                className="size-3 text-muted-foreground"
                aria-label={text.fromGoogle}
              />
            )}
          </li>
        ))}
      </Section>
      <Section
        icon={CheckSquare}
        title={text.tasksForToday}
        empty={!brief.tasks.length}
      >
        {brief.tasks.map((t) => (
          <li key={t.id} className="flex gap-2">
            <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
              {t.dueTime ?? ""}
            </span>
            {t.title}
          </li>
        ))}
      </Section>
      {brief.carriedOver.length > 0 && (
        <Section
          icon={History}
          title={text.carriedOver(brief.carriedOver.length)}
        >
          {brief.carriedOver.slice(0, 5).map((t) => (
            <li key={t.id} className="flex gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">
                {formatDate(t.dueDate!, "d.M")}
              </span>
              {t.title}
            </li>
          ))}
        </Section>
      )}
      {brief.bills.length > 0 && (
        <Section icon={Receipt} title={text.bills}>
          {brief.bills.map((b) => (
            <li
              key={`${b.id}-${b.date}`}
              className="flex justify-between gap-2"
            >
              <span>
                {b.description}
                <span className="ms-2 text-xs text-muted-foreground">
                  {b.daysLeft === 0
                    ? common.today
                    : b.daysLeft === 1
                      ? common.tomorrow
                      : formatDate(b.date, "d.M")}
                </span>
              </span>
              <span className="text-expense tabular-nums">
                {formatCurrency(b.amount)}
              </span>
            </li>
          ))}
        </Section>
      )}
      <Section icon={Scale} title={text.monthSoFar}>
        <li className="flex justify-between">
          <span className="text-muted-foreground">{money.income}</span>
          <span className="text-income tabular-nums">
            {formatCurrency(brief.month.income)}
          </span>
        </li>
        <li className="flex justify-between">
          <span className="text-muted-foreground">{money.expenses}</span>
          <span className="text-expense tabular-nums">
            {formatCurrency(brief.month.expense)}
          </span>
        </li>
        <li className="flex justify-between font-medium">
          <span>{money.balance}</span>
          <span
            className={cn(
              "tabular-nums",
              brief.month.balance >= 0 ? "text-income" : "text-expense",
            )}
          >
            {formatCurrency(brief.month.balance)}
          </span>
        </li>
      </Section>
    </div>
  );
}

function WeekBrief() {
  const tasks = useAppStore((s) => s.tasks);
  const transactions = useAppStore((s) => s.transactions);
  const today = todayKey();
  const weekStart = useAppStore((s) => s.settings.prefs?.weekStart ?? 0);
  const week = useMemo(
    () => weekSummary({ tasks, transactions }, today, weekStart),
    [tasks, transactions, today, weekStart],
  );
  const change = week.expense - week.lastWeekExpense;
  const text = t().today.briefDialog;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {text.weekFrom(formatDate(week.from, "EEEE, d.M"))}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">
            {text.tasksCompleted}
          </div>
          <div className="text-2xl font-semibold tabular-nums">{week.done}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">{text.slipped}</div>
          <div
            className={cn(
              "text-2xl font-semibold tabular-nums",
              week.slipped > 0 && "text-destructive",
            )}
          >
            {week.slipped}
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-xs text-muted-foreground">
          {text.spentThisWeek}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-semibold text-expense tabular-nums">
            {formatCurrency(week.expense)}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-sm",
              change > 0 ? "text-expense" : "text-income",
            )}
          >
            {change > 0 ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
            {change === 0
              ? text.sameAsLastWeek
              : change > 0
                ? text.moreThanLastWeek(formatCurrency(Math.abs(change)))
                : text.lessThanLastWeek(formatCurrency(Math.abs(change)))}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The morning brief: today's events and tasks, what slipped, bills coming
 * up, and the month so far — plus, on Fridays, how the week went. Opens by
 * itself on the first visit of the day (can be turned off in settings).
 */
export function BriefDialog() {
  const view = useBrief((s) => s.view);
  const open = useBrief((s) => s.open);
  const close = useBrief((s) => s.close);
  const hydrated = useAppStore((s) => s.hydrated);
  const [tab, setTab] = useState<View>("day");

  useEffect(() => {
    if (!hydrated) return;
    const prefs = useDevicePrefs.getState();
    if (!prefs.loaded) prefs.load();
    const { autoBrief, briefShownOn, markBriefShown, onboarded } =
      useDevicePrefs.getState();
    // The first-run questions come first; the brief waits for the next visit.
    const named = !!useAppStore.getState().settings.prefs?.userName;
    if (!onboarded && !named) return;
    const today = todayKey();
    const now = new Date();
    if (
      !autoBrief ||
      briefShownOn === today ||
      now.getHours() < AUTO_FROM_HOUR
    ) {
      return;
    }
    markBriefShown(today);
    open(now.getDay() === FRIDAY ? "week" : "day");
  }, [hydrated, open]);

  // Each opening starts on the view it was asked for.
  const [openedWith, setOpenedWith] = useState<View | null>(null);
  if (view !== openedWith) {
    setOpenedWith(view);
    if (view) setTab(view);
  }

  return (
    <Dialog open={view !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sunrise className="size-5 text-primary" />
            {greeting(new Date())}
          </DialogTitle>
          <DialogDescription>
            {formatDate(todayKey(), t().today.dates.weekdayDayMonthLong)}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as View)}>
          <TabsList className="w-full">
            <TabsTrigger value="day">
              {t().today.briefDialog.morningBrief}
            </TabsTrigger>
            <TabsTrigger value="week">
              {t().today.briefDialog.weekSummary}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "day" ? <DayBrief /> : <WeekBrief />}
        <DialogFooter>
          <Button onClick={close}>{t().common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
