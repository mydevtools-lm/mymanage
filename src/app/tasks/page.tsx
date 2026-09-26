"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategorySelect, NONE, SimpleSelect } from "@/components/fields";
import {
  EmptyState,
  Hydrated,
  PageHeader,
  PRIORITY_LABELS,
} from "@/components/shared";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { useAppStore } from "@/lib/store";
import type { Priority, Task } from "@/lib/types";

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const ALL = "__all";

function sortTasks(a: Task, b: Task) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

export default function TasksPage() {
  const tasks = useAppStore((s) => s.tasks);
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState(ALL);
  const [categoryId, setCategoryId] = useState(NONE);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => {
        // Archived work lives on the daily screen's archive tab.
        if (t.archivedAt) return false;
        if (status === "open" && t.completed) return false;
        if (status === "done" && !t.completed) return false;
        if (priority !== ALL && t.priority !== priority) return false;
        if (categoryId !== NONE && t.categoryId !== categoryId) return false;
        if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort(sortTasks);
  }, [tasks, status, priority, categoryId, query]);

  const openCount = tasks.filter((t) => !t.completed && !t.archivedAt).length;
  const activeCount = tasks.filter((t) => !t.archivedAt).length;
  const archivedCount = tasks.filter((t) => t.archivedAt).length;

  return (
    <>
      <PageHeader
        title="משימות"
        description={`${openCount} משימות פתוחות מתוך ${activeCount}${archivedCount ? ` · ${archivedCount} בארכיון` : ""}`}
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs value={status} onValueChange={(v) => setStatus(v as string)}>
            <TabsList>
              <TabsTrigger value="open">פתוחות</TabsTrigger>
              <TabsTrigger value="done">הושלמו</TabsTrigger>
              <TabsTrigger value="all">הכול</TabsTrigger>
            </TabsList>
          </Tabs>
          <SimpleSelect
            className="w-36"
            value={priority}
            onChange={setPriority}
            options={[
              { value: ALL, label: "כל העדיפויות" },
              ...(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => ({
                value: p,
                label: PRIORITY_LABELS[p],
              })),
            ]}
          />
          <CategorySelect
            kind="task"
            includeAll
            className="w-40"
            value={categoryId}
            onChange={setCategoryId}
          />
          <div className="relative ms-auto w-56">
            <Search className="absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-8"
              placeholder="חיפוש..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="אין משימות להצגה"
            hint={
              tasks.length === 0
                ? "לחץ על ״משימה חדשה״ כדי להתחיל"
                : "נסה לשנות את הסינון"
            }
          />
        ) : (
          <div className="grid gap-2">
            {filtered.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onEdit={(task) => {
                  setEditing(task);
                  setDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </Hydrated>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
      />
    </>
  );
}
