"use client";

import { CalendarClock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryBadge, PriorityBadge } from "@/components/shared";
import { useAppStore } from "@/lib/store";
import { todayKey } from "@/lib/format";
import type { Task } from "@/lib/types";

export function DayTaskRow({ task }: { task: Task }) {
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
