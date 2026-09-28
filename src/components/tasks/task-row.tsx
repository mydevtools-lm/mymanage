"use client";

import { CalendarClock, Check, Pencil, SunMedium, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryBadge, PriorityBadge } from "@/components/shared";
import { RowActions, type RowAction } from "@/components/row-actions";
import { SwipeRow } from "@/components/swipe-row";
import { useAppStore } from "@/lib/store";
import { formatDate, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

/**
 * One task, everywhere a task is listed. On a phone: swipe right to finish,
 * left to push to tomorrow, and "⋯" for the rest.
 */
export function TaskRow({
  task,
  onEdit,
  compact,
  hideDate,
  trailing,
}: {
  task: Task;
  onEdit?: (task: Task) => void;
  /** Drop the description line — for tight spaces like the calendar panel. */
  compact?: boolean;
  /** Skip the due date when the surrounding screen already says which day. */
  hideDate?: boolean;
  /** A one-tap action shown in the row itself, before the "⋯" menu. */
  trailing?: React.ReactNode;
}) {
  const toggleTask = useAppStore((s) => s.toggleTask);
  const snoozeTask = useAppStore((s) => s.snoozeTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const category = useAppStore((s) =>
    s.categories.find((c) => c.id === task.categoryId),
  );
  const overdue =
    !task.completed && !!task.dueDate && task.dueDate < todayKey();

  const actions: RowAction[] = [
    ...(onEdit
      ? [{ label: "עריכה", icon: Pencil, onSelect: () => onEdit(task) }]
      : []),
    {
      label: "דחה למחר",
      icon: SunMedium,
      onSelect: () => snoozeTask(task.id),
    },
    {
      label: "מחיקה",
      icon: Trash2,
      destructive: true,
      onSelect: () => deleteTask(task.id),
    },
  ];

  const meta = (
    <>
      {!hideDate && task.dueDate && (
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            overdue ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          <CalendarClock className="size-3.5" />
          {formatDate(task.dueDate)}
          {task.dueTime && (
            <span className="tabular-nums">· {task.dueTime}</span>
          )}
        </span>
      )}
      <CategoryBadge category={category} />
      <PriorityBadge priority={task.priority} />
    </>
  );

  return (
    <SwipeRow
      right={{
        label: "בוצע",
        icon: Check,
        onSwipe: () => toggleTask(task.id),
        className: "bg-income",
      }}
      left={{
        label: "מחר",
        icon: SunMedium,
        onSwipe: () => snoozeTask(task.id),
        className: "bg-sky-500",
      }}
    >
      <div
        className={cn(
          "group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors can-hover:hover:bg-accent/40",
          task.completed && "opacity-60",
        )}
      >
        <Checkbox
          checked={task.completed}
          onCheckedChange={() => toggleTask(task.id)}
          aria-label={`סימון ${task.title}`}
          className="size-5"
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
          {/* Phones: details go under the title instead of crowding the row. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 empty:hidden sm:hidden">
            {meta}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">{meta}</div>
        {trailing}
        <RowActions actions={actions} />
      </div>
    </SwipeRow>
  );
}
