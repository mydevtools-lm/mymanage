"use client";

import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CategoryBadge, PriorityBadge } from "@/components/shared";
import { useAppStore } from "@/lib/store";
import { formatDate, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

export function TaskRow({
  task,
  onEdit,
  compact,
}: {
  task: Task;
  onEdit?: (task: Task) => void;
  compact?: boolean;
}) {
  const toggleTask = useAppStore((s) => s.toggleTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const category = useAppStore((s) =>
    s.categories.find((c) => c.id === task.categoryId),
  );
  const overdue =
    !task.completed && !!task.dueDate && task.dueDate < todayKey();

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/40",
        task.completed && "opacity-60",
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => toggleTask(task.id)}
        aria-label="סימון משימה"
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate font-medium",
            task.completed && "line-through",
          )}
        >
          {task.title}
        </div>
        {!compact && task.description && (
          <div className="truncate text-xs text-muted-foreground">
            {task.description}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              overdue
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            <CalendarClock className="size-3.5" />
            {formatDate(task.dueDate)}
          </span>
        )}
        <CategoryBadge category={category} />
        <PriorityBadge priority={task.priority} />
        {onEdit && (
          <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(task)}
              aria-label="עריכה"
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              onClick={() => deleteTask(task.id)}
              aria-label="מחיקה"
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
