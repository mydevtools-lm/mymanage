"use client";

import { useMemo, useState } from "react";
import { addDays } from "date-fns";
import {
  Archive,
  CalendarDays,
  CheckCheck,
  CheckSquare,
  GripVertical,
  ListChecks,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategorySelect, Field, NONE, SimpleSelect } from "@/components/fields";
import {
  EmptyState,
  Hydrated,
  PageHeader,
  PRIORITY_LABELS,
} from "@/components/shared";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { ArchiveList } from "@/components/tasks/archive-list";
import { RoutineList } from "@/components/tasks/routine-list";
import { useAppStore } from "@/lib/store";
import { dayTargets, groupDropDate, groupTasksByWhen } from "@/lib/task-groups";
import { toast } from "sonner";
import { toDateKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Priority, Routine, Task } from "@/lib/types";

const ALL = "__all";

const PRIORITY_OPTIONS = [
  { value: ALL, label: "כל העדיפויות" },
  ...(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => ({
    value: p,
    label: PRIORITY_LABELS[p],
  })),
];

function BulkDateDialog({
  open,
  onOpenChange,
  count,
  title,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** Instead of "date for N tasks" — for a single task. */
  title?: string;
  onPick: (date: string | undefined) => void;
}) {
  const [custom, setCustom] = useState("");
  const today = todayKey();
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const pick = (date: string | undefined) => {
    onPick(date);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom) pick(custom);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title ?? `תאריך ל־${count} משימות`}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" onClick={() => pick(today)}>
              היום
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => pick(tomorrow)}
            >
              מחר
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => pick(undefined)}
            >
              בלי תאריך
            </Button>
          </div>
          <Field label="או תאריך אחר" htmlFor="bulk-date">
            <Input
              id="bulk-date"
              type="date"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={!custom}>
              קביעה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TasksPage() {
  const tasks = useAppStore((s) => s.tasks);
  const setTasksDate = useAppStore((s) => s.setTasksDate);
  const completeTasks = useAppStore((s) => s.completeTasks);
  const deleteTasks = useAppStore((s) => s.deleteTasks);
  const updateTask = useAppStore((s) => s.updateTask);

  const [view, setView] = useState("active");
  const [priority, setPriority] = useState(ALL);
  const [categoryId, setCategoryId] = useState(NONE);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [newRoutine, setNewRoutine] = useState(false);
  const routineCount = useAppStore((s) => s.routines.length);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateDialog, setDateDialog] = useState(false);
  // Dragging a task to another day (by its handle), and the one task whose
  // date is being picked — from a click on the handle or "another date".
  const [dragging, setDragging] = useState<Task | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [dateFor, setDateFor] = useState<Task | null>(null);

  const today = todayKey();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      // Ticking a task archives it; archived work has its own tab.
      if (t.archivedAt) return false;
      if (priority !== ALL && t.priority !== priority) return false;
      if (categoryId !== NONE && t.categoryId !== categoryId) return false;
      if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [tasks, priority, categoryId, query]);

  const groups = useMemo(
    () => groupTasksByWhen(filtered, today),
    [filtered, today],
  );

  const activeCount = tasks.filter((t) => !t.archivedAt).length;
  const archivedCount = tasks.filter((t) => t.archivedAt).length;
  const filterCount =
    (priority !== ALL ? 1 : 0) + (categoryId !== NONE ? 1 : 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const selectedIds = [...selected];
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  const targets = useMemo(() => dayTargets(today), [today]);
  const dayName = (date: string | undefined) =>
    targets.find((t) => t.date === date)?.label ??
    (date ? date.split("-").reverse().join(".") : "בלי תאריך");

  /** Move one task to a day, keeping its time — as dragging in the calendar
   *  does — with an undo. No date clears the time too. */
  const moveTo = (task: Task, date: string | undefined) => {
    if (date === task.dueDate) return;
    const before = { dueDate: task.dueDate, dueTime: task.dueTime };
    if (date) updateTask(task.id, { dueDate: date });
    else setTasksDate([task.id], undefined);
    toast(`״${task.title}״ הועברה ל${dayName(date)}`, {
      action: {
        label: "ביטול",
        onClick: () =>
          before.dueDate
            ? updateTask(task.id, before)
            : setTasksDate([task.id], undefined),
      },
    });
  };

  const endDrag = () => {
    setDragging(null);
    setOver(null);
  };

  /** Where a dragged task may land. `date` undefined = no date; `pick`
   *  opens the date dialog instead. */
  const dropZone = (
    key: string,
    target: { date: string | undefined } | "pick",
  ) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== key) setOver(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setOver((o) => (o === key ? null : o));
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const task = dragging;
      endDrag();
      if (!task) return;
      if (target === "pick") setDateFor(task);
      else moveTo(task, target.date);
    },
  });

  const dragHandle = (task: Task) => (
    <button
      type="button"
      draggable
      aria-label={`העברת ״${task.title}״ ליום אחר`}
      title="גרירה ליום אחר, או לחיצה לבחירת תאריך"
      className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60 transition-colors active:cursor-grabbing can-hover:hover:text-foreground"
      onClick={() => setDateFor(task)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        const row = e.currentTarget.closest("[data-task-row]");
        if (row) e.dataTransfer.setDragImage(row, 24, 20);
        // After the drag has begun: changing the page inside dragstart can
        // cancel the drag.
        setTimeout(() => setDragging(task), 0);
      }}
      onDragEnd={endDrag}
    >
      <GripVertical className="size-4" />
    </button>
  );

  const filters = (
    <>
      <SimpleSelect
        className="md:w-36"
        value={priority}
        onChange={setPriority}
        options={PRIORITY_OPTIONS}
        label="עדיפות"
      />
      <CategorySelect
        kind="task"
        includeAll
        className="md:w-40"
        value={categoryId}
        onChange={setCategoryId}
      />
    </>
  );

  return (
    <>
      <PageHeader
        title="משימות"
        description={`${activeCount} פעילות${archivedCount ? ` · ${archivedCount} בארכיון` : ""}`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setEditingRoutine(null);
              setNewRoutine(view === "routines");
              setDialogOpen(true);
            }}
          >
            <Plus />
            {view === "routines" ? "משימה קבועה" : "משימה חדשה"}
          </Button>
        }
      />

      <Hydrated>
        <div className="mb-4 flex flex-wrap items-center gap-2 md:flex-nowrap">
          <Tabs
            value={view}
            onValueChange={(v) => {
              setView(v as string);
              stopSelecting();
            }}
          >
            <TabsList>
              <TabsTrigger value="active">פעילות</TabsTrigger>
              <TabsTrigger value="routines">
                <Repeat />
                קבועות{routineCount > 0 && ` (${routineCount})`}
              </TabsTrigger>
              <TabsTrigger value="archive">
                <Archive />
                ארכיון{archivedCount > 0 && ` (${archivedCount})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {view === "active" && (
            <>
              <div className="relative min-w-40 flex-1 md:max-w-xs">
                <Search className="absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="ps-8"
                  data-search
                  placeholder="חיפוש..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* Desktop: filters inline. Phone: behind a button with a count. */}
              <div className="hidden items-center gap-2 md:flex">{filters}</div>
              <Button
                variant="outline"
                className="md:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal />
                סינון
                {filterCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {filterCount}
                  </span>
                )}
              </Button>

              <Button
                variant={selecting ? "secondary" : "ghost"}
                className="md:ms-auto"
                onClick={() =>
                  selecting ? stopSelecting() : setSelecting(true)
                }
              >
                <ListChecks />
                {selecting ? "סיום בחירה" : "בחירה"}
              </Button>
            </>
          )}
        </div>

        {view === "archive" ? (
          <ArchiveList />
        ) : view === "routines" ? (
          <RoutineList
            onEdit={(routine) => {
              setEditing(null);
              setEditingRoutine(routine);
              setDialogOpen(true);
            }}
            onNew={() => {
              setEditing(null);
              setEditingRoutine(null);
              setNewRoutine(true);
              setDialogOpen(true);
            }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="אין משימות להצגה"
            hint={
              activeCount === 0
                ? "מה הדבר הראשון שצריך לעשות?"
                : "נסה לשנות את הסינון"
            }
            action={
              activeCount === 0
                ? {
                    label: "משימה חדשה",
                    onClick: () => {
                      setEditing(null);
                      setDialogOpen(true);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className={cn("grid gap-5", selecting && "pb-20")}>
            {selecting && (
              <button
                type="button"
                className="justify-self-start text-sm text-primary underline-offset-4 hover:underline"
                onClick={() =>
                  setSelected(
                    allVisibleSelected
                      ? new Set()
                      : new Set(filtered.map((t) => t.id)),
                  )
                }
              >
                {allVisibleSelected ? "ביטול הבחירה" : "בחירת הכול"}
              </button>
            )}
            {dragging && (
              <div
                role="group"
                aria-label="העברה ליום"
                className="sticky top-2 z-30 flex flex-wrap gap-1.5 rounded-xl border bg-popover p-2 shadow-lg"
              >
                {targets.map((t) => (
                  <div
                    key={t.key}
                    data-drop-day={t.key}
                    {...dropZone(t.key, { date: t.date })}
                    className={cn(
                      "rounded-lg border border-dashed px-3 py-1.5 text-sm transition-colors",
                      t.date === dragging.dueDate && "opacity-50",
                      over === t.key &&
                        "border-solid border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {t.label}
                  </div>
                ))}
                <div
                  data-drop-day="pick"
                  {...dropZone("pick", "pick")}
                  className={cn(
                    "rounded-lg border border-dashed px-3 py-1.5 text-sm transition-colors",
                    over === "pick" &&
                      "border-solid border-primary bg-primary text-primary-foreground",
                  )}
                >
                  תאריך אחר…
                </div>
              </div>
            )}
            {groups.map(({ group, label, tasks: groupTasks }) => {
              const drop = groupDropDate(group, today);
              return (
                <section
                  key={group}
                  aria-label={label}
                  {...(drop ? dropZone(`group-${group}`, drop) : {})}
                  className={cn(
                    "grid gap-2 rounded-lg transition-colors",
                    dragging &&
                      drop &&
                      "outline-1 outline-dashed outline-offset-4 outline-primary/40",
                    over === `group-${group}` && "bg-primary/5 outline-primary",
                  )}
                >
                  <h2
                    className={cn(
                      "flex items-center gap-2 text-sm font-semibold",
                      group === "overdue"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {label}
                    <span className="font-normal">({groupTasks.length})</span>
                  </h2>
                  {groupTasks.map((t) => (
                    <div key={t.id} data-task-row>
                      <TaskRow
                        task={t}
                        inlineEdit
                        hideDate={group === "today"}
                        handle={selecting ? undefined : dragHandle(t)}
                        onEdit={(task) => {
                          setEditing(task);
                          setEditingRoutine(null);
                          setDialogOpen(true);
                        }}
                        selection={
                          selecting
                            ? {
                                selected: selected.has(t.id),
                                onToggle: () => toggle(t.id),
                              }
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}

        {/* Bulk action bar: above the phone tab bar, at the bottom on desktop. */}
        {selecting && (
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-4 md:ps-60 sidebar-collapsed:md:ps-20">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border bg-popover p-2 shadow-lg">
              <span className="px-2 text-sm font-medium">
                {selected.size} נבחרו
              </span>
              <div className="ms-auto flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={selected.size === 0}
                  onClick={() => setDateDialog(true)}
                >
                  <CalendarDays /> תאריך
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={selected.size === 0}
                  onClick={() => {
                    completeTasks(selectedIds);
                    stopSelecting();
                  }}
                >
                  <CheckCheck /> בוצע
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={selected.size === 0}
                  onClick={() => {
                    deleteTasks(selectedIds);
                    stopSelecting();
                  }}
                >
                  <Trash2 /> מחיקה
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="סיום בחירה"
                  onClick={stopSelecting}
                >
                  <X />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Hydrated>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader>
            <SheetTitle>סינון משימות</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 px-4 pb-4">
            <Field label="עדיפות">
              <SimpleSelect
                value={priority}
                onChange={setPriority}
                options={PRIORITY_OPTIONS}
                label="עדיפות"
              />
            </Field>
            <Field label="קטגוריה">
              <CategorySelect
                kind="task"
                includeAll
                value={categoryId}
                onChange={setCategoryId}
              />
            </Field>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPriority(ALL);
                  setCategoryId(NONE);
                }}
              >
                ניקוי
              </Button>
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                הצגה
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <BulkDateDialog
        open={dateDialog}
        onOpenChange={setDateDialog}
        count={selected.size}
        onPick={(date) => {
          setTasksDate(selectedIds, date);
          stopSelecting();
        }}
      />

      <BulkDateDialog
        open={!!dateFor}
        onOpenChange={(open) => !open && setDateFor(null)}
        count={1}
        title={dateFor ? `העברת ״${dateFor.title}״` : undefined}
        onPick={(date) => {
          if (dateFor) moveTo(dateFor, date);
        }}
      />

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        routine={editingRoutine}
        defaultRepeat={
          newRoutine && !editing && !editingRoutine
            ? { kind: "daily" }
            : undefined
        }
      />
    </>
  );
}
