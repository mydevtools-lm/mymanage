"use client";

import { useMemo, useState } from "react";
import { addDays } from "date-fns";
import {
  Archive,
  CalendarDays,
  CheckCheck,
  CheckSquare,
  ListChecks,
  Plus,
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
import { useAppStore } from "@/lib/store";
import { groupTasksByWhen } from "@/lib/task-groups";
import { toDateKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Priority, Task } from "@/lib/types";

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
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
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
            <DialogTitle>תאריך ל־{count} משימות</DialogTitle>
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

  const [view, setView] = useState("active");
  const [priority, setPriority] = useState(ALL);
  const [categoryId, setCategoryId] = useState(NONE);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateDialog, setDateDialog] = useState(false);

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
              setDialogOpen(true);
            }}
          >
            <Plus />
            משימה חדשה
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
            {groups.map(({ group, label, tasks: groupTasks }) => (
              <section key={group} className="grid gap-2">
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
                  <TaskRow
                    key={t.id}
                    task={t}
                    inlineEdit
                    hideDate={group === "today"}
                    onEdit={(task) => {
                      setEditing(task);
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
                ))}
              </section>
            ))}
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

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
      />
    </>
  );
}
