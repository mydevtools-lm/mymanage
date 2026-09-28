"use client";

import { Pause, Pencil, Play, Repeat, Trash2 } from "lucide-react";
import { CategoryBadge, EmptyState, PriorityBadge } from "@/components/shared";
import { RowActions } from "@/components/row-actions";
import { useAppStore } from "@/lib/store";
import { describeRepeat, nextOccurrence } from "@/lib/routines";
import { addDays } from "date-fns";
import { formatDate, toDateKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Routine } from "@/lib/types";

function whenNext(routine: Routine, today: string) {
  const next = nextOccurrence(routine, today);
  if (!next) return routine.paused ? "מושהית" : "אין מועד קרוב";
  if (next === today) return "היום";
  if (next === toDateKey(addDays(new Date(), 1))) return "מחר";
  return formatDate(next);
}

function RoutineRow({
  routine,
  onEdit,
}: {
  routine: Routine;
  onEdit: (routine: Routine) => void;
}) {
  const togglePause = useAppStore((s) => s.toggleRoutinePause);
  const deleteRoutine = useAppStore((s) => s.deleteRoutine);
  const category = useAppStore((s) =>
    s.categories.find((c) => c.id === routine.categoryId),
  );
  const today = todayKey();

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
        routine.paused && "opacity-60",
      )}
    >
      <Repeat className="size-4 shrink-0 text-primary" />
      <button
        type="button"
        onClick={() => onEdit(routine)}
        className="min-w-0 flex-1 text-start"
      >
        <div className="truncate font-medium">{routine.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{describeRepeat(routine.repeat)}</span>
          {routine.dueTime && (
            <span className="tabular-nums">· {routine.dueTime}</span>
          )}
          <span>· הבאה: {whenNext(routine, today)}</span>
        </div>
      </button>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <CategoryBadge category={category} />
        <PriorityBadge priority={routine.priority} />
      </div>
      <RowActions
        actions={[
          {
            label: "עריכה",
            icon: Pencil,
            onSelect: () => onEdit(routine),
          },
          routine.paused
            ? {
                label: "חידוש",
                icon: Play,
                onSelect: () => togglePause(routine.id),
              }
            : {
                label: "השהיה",
                icon: Pause,
                onSelect: () => togglePause(routine.id),
              },
          {
            label: "מחיקה",
            icon: Trash2,
            destructive: true,
            onSelect: () => deleteRoutine(routine.id),
          },
        ]}
      />
    </div>
  );
}

/** Routines — the tasks that come back by themselves. */
export function RoutineList({
  onEdit,
  onNew,
}: {
  onEdit: (routine: Routine) => void;
  onNew: () => void;
}) {
  const routines = useAppStore((s) => s.routines);

  if (routines.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title="אין משימות קבועות"
        hint="תרופות, אימון, מיילים — מגדירים פעם אחת, ומופיעות לבד כל יום"
        action={{ label: "משימה קבועה", onClick: onNew }}
      />
    );
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        כל משימה כאן מופיעה לבד ביום שלה. סימון מעביר לארכיון רק את העותק של
        אותו יום.
      </p>
      {routines.map((r) => (
        <RoutineRow key={r.id} routine={r} onEdit={onEdit} />
      ))}
    </div>
  );
}
