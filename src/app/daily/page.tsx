"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CategoryBadge,
  Hydrated,
  PageHeader,
  PriorityBadge,
} from "@/components/shared";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useAppStore } from "@/lib/store";
import { formatDate, toDateKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

function DayPicker({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const today = todayKey();
  const parsed = parseISO(date);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="יום קודם"
        onClick={() => onChange(toDateKey(addDays(parsed, -1)))}
      >
        <ChevronRight />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="יום הבא"
        onClick={() => onChange(toDateKey(addDays(parsed, 1)))}
      >
        <ChevronLeft />
      </Button>
      {date !== today && (
        <Button variant="ghost" onClick={() => onChange(today)}>
          <Sun /> היום
        </Button>
      )}
      <h2 className="ms-1 text-lg font-semibold">
        {date === today
          ? "היום"
          : format(parsed, "EEEE, d בMMMM", { locale: he })}
      </h2>
      <span className="text-sm text-muted-foreground">
        {format(parsed, "d.M.yyyy")}
      </span>
      <Input
        type="date"
        value={date}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="ms-auto w-40"
      />
    </div>
  );
}

function DailyRow({ task }: { task: Task }) {
  const toggleTask = useAppStore((s) => s.toggleTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const category = useAppStore((s) =>
    s.categories.find((c) => c.id === task.categoryId),
  );
  const overdue = !!task.dueDate && task.dueDate < todayKey();

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-colors hover:bg-accent/40">
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => toggleTask(task.id)}
        aria-label={`סימון ${task.title}`}
        className="size-5"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{task.title}</div>
        {task.description && (
          <div className="truncate text-xs text-muted-foreground">
            {task.description}
          </div>
        )}
      </div>
      {overdue && (
        <span className="flex items-center gap-1 text-xs font-medium text-destructive">
          <CalendarClock className="size-3.5" />
          באיחור
        </span>
      )}
      <CategoryBadge category={category} />
      <PriorityBadge priority={task.priority} />
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-destructive opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="מחיקה"
        onClick={() => deleteTask(task.id)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function ArchiveList() {
  const tasks = useAppStore((s) => s.tasks);
  const restoreTask = useAppStore((s) => s.restoreTask);
  const deleteTask = useAppStore((s) => s.deleteTask);

  // Grouped by the day they were ticked off, newest first.
  const groups = useMemo(() => {
    const archived = tasks.filter((t) => t.archivedAt);
    const map = new Map<string, Task[]>();
    for (const task of archived) {
      const day = (task.completedAt ?? task.archivedAt!).slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(task);
      map.set(day, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tasks]);

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          הארכיון ריק. משימה שתסמן כבוצעה תגיע לכאן.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map(([day, dayTasks]) => (
        <Card key={day}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {day === todayKey()
                ? "היום"
                : formatDate(day, "EEEE, d בMMMM yyyy")}
            </CardTitle>
            <CardDescription>{dayTasks.length} משימות הושלמו</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            {dayTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/40"
              >
                <CheckCircle2 className="size-4 shrink-0 text-income" />
                <span className="flex-1 truncate text-sm text-muted-foreground line-through">
                  {task.title}
                </span>
                <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="החזרה לרשימה"
                    title="החזר לרשימה הפעילה"
                    onClick={() => restoreTask(task.id)}
                  >
                    <RotateCcw />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label="מחיקה"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DailyPage() {
  const tasks = useAppStore((s) => s.tasks);
  const [date, setDate] = useState(todayKey());
  const [dialogOpen, setDialogOpen] = useState(false);

  const today = todayKey();

  const { dayTasks, carriedOver } = useMemo(() => {
    const active = tasks.filter((t) => !t.archivedAt);
    return {
      dayTasks: active.filter((t) => t.dueDate === date),
      // Only shown on today: unfinished work whose date has already passed.
      carriedOver:
        date === today
          ? active.filter((t) => t.dueDate && t.dueDate < today)
          : [],
    };
  }, [tasks, date, today]);

  const archivedCount = tasks.filter((t) => t.archivedAt).length;
  const doneToday = tasks.filter(
    (t) => t.archivedAt && (t.completedAt ?? "").slice(0, 10) === date,
  ).length;

  return (
    <>
      <PageHeader
        title="משימות יומיות"
        description="סמן מה בוצע — המשימה עוברת לארכיון"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            משימה ליום זה
          </Button>
        }
      />

      <Hydrated>
        <Tabs defaultValue="day">
          <TabsList className="mb-4">
            <TabsTrigger value="day">היומן שלי</TabsTrigger>
            <TabsTrigger value="archive">
              <Archive /> ארכיון {archivedCount > 0 && `(${archivedCount})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="grid gap-4">
            <DayPicker date={date} onChange={setDate} />

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {isSameDay(parseISO(date), new Date())
                        ? "המשימות של היום"
                        : `משימות ל־${formatDate(date)}`}
                    </CardTitle>
                    <CardDescription>
                      {dayTasks.length === 0
                        ? "אין משימות פתוחות ליום זה"
                        : `${dayTasks.length} פתוחות`}
                      {doneToday > 0 && ` · ${doneToday} הושלמו`}
                    </CardDescription>
                  </div>
                  {dayTasks.length === 0 && doneToday > 0 && (
                    <span className="flex items-center gap-1.5 text-sm text-income">
                      <CheckCircle2 className="size-4" /> הכול בוצע
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-2">
                {dayTasks.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    שום דבר לא מתוזמן ליום הזה.
                  </p>
                ) : (
                  dayTasks.map((task) => <DailyRow key={task.id} task={task} />)
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
                      <DailyRow task={task} />
                      <span
                        className={cn(
                          "px-3 text-xs text-muted-foreground",
                          "-mt-0.5",
                        )}
                      >
                        מועד מקורי: {formatDate(task.dueDate!)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="archive">
            <ArchiveList />
          </TabsContent>
        </Tabs>
      </Hydrated>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDueDate={date}
      />
    </>
  );
}
