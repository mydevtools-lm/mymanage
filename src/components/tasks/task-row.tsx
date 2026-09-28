"use client";

import { useState } from "react";
import { CalendarClock, Check, Pencil, SunMedium, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryBadge, PriorityBadge } from "@/components/shared";
import { RowActions, type RowAction } from "@/components/row-actions";
import { SwipeRow } from "@/components/swipe-row";
import { useAppStore } from "@/lib/store";
import { formatDate, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

/** Title that turns into a text field on click; Enter saves, Esc cancels. */
function EditableTitle({ task }: { task: Task }) {
  const updateTask = useAppStore((s) => s.updateTask);
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(task.title)}
        title="לחץ לעריכת הכותרת"
        className={cn(
          "block max-w-full truncate text-start font-medium",
          task.completed && "line-through",
        )}
      >
        {task.title}
      </button>
    );
  }

  const save = () => {
    const title = draft.trim();
    if (title && title !== task.title) updateTask(task.id, { title });
    setDraft(null);
  };

  return (
    <input
      autoFocus
      value={draft}
      aria-label="כותרת המשימה"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setDraft(null);
      }}
      className="w-full rounded-md border border-ring bg-background px-1.5 py-0.5 font-medium outline-none ring-3 ring-ring/30"
    />
  );
}

/**
 * One task, everywhere a task is listed. On a phone: swipe right to finish,
 * left to push to tomorrow, and "⋯" for the rest.
 *
 * With `selection` the row switches to picking mode: tapping anywhere
 * toggles it, and the per-row actions and swipes step aside.
 */
export function TaskRow({
  task,
  onEdit,
  compact,
  hideDate,
  hideTime,
  trailing,
  inlineEdit,
  selection,
}: {
  task: Task;
  onEdit?: (task: Task) => void;
  /** Drop the description line — for tight spaces like the calendar panel. */
  compact?: boolean;
  /** Skip the due date when the surrounding screen already says which day. */
  hideDate?: boolean;
  /** Skip the time too — when a timeline already shows it beside the row. */
  hideTime?: boolean;
  /** A one-tap action shown in the row itself, before the "⋯" menu. */
  trailing?: React.ReactNode;
  /** Click the title to rename in place. */
  inlineEdit?: boolean;
  selection?: { selected: boolean; onToggle: () => void };
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
      {/* The screen already says which day; the time it can't know. */}
      {hideDate && !hideTime && task.dueTime && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <CalendarClock className="size-3.5" />
          {task.dueTime}
        </span>
      )}
      <CategoryBadge category={category} />
      <PriorityBadge priority={task.priority} />
    </>
  );

  const body = (
    <>
      <div className="min-w-0 flex-1">
        {inlineEdit && !selection ? (
          <EditableTitle task={task} />
        ) : (
          <div
            className={cn(
              "truncate font-medium",
              task.completed && "line-through",
            )}
          >
            {task.title}
          </div>
        )}
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
    </>
  );

  if (selection) {
    return (
      <div
        role="checkbox"
        aria-checked={selection.selected}
        aria-label={`בחירת ${task.title}`}
        tabIndex={0}
        onClick={selection.onToggle}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            selection.onToggle();
          }
        }}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
          selection.selected
            ? "border-primary bg-accent/60 ring-1 ring-primary"
            : "can-hover:hover:bg-accent/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selection.selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input",
          )}
        >
          {selection.selected && <Check className="size-3.5" />}
        </span>
        {body}
      </div>
    );
  }

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
        {body}
        {trailing}
        <RowActions actions={actions} />
      </div>
    </SwipeRow>
  );
}
