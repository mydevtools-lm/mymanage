"use client";

import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/fields";
import { weekdayShort } from "@/lib/routines";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Repeat } from "@/lib/types";

const NEVER = "never";

function kindOptions() {
  const text = t().tasks.repeat;
  return [
    { value: NEVER, label: text.never },
    { value: "daily", label: text.daily },
    { value: "weekly", label: text.weekly },
    { value: "monthly", label: text.monthly },
    { value: "yearly", label: text.yearly },
  ];
}

function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * How often a task comes back. `startDate` seeds sensible defaults: the
 * weekday for "weekly", the day of the month for "monthly".
 */
export function RepeatField({
  value,
  onChange,
  startDate,
  allowNever = true,
}: {
  value: Repeat | null;
  onChange: (value: Repeat | null) => void;
  startDate: string;
  allowNever?: boolean;
}) {
  const kind = value?.kind ?? NEVER;
  const text = t().tasks;
  const options = kindOptions();

  function setKind(next: string) {
    if (next === NEVER) onChange(null);
    else if (next === "daily") onChange({ kind: "daily" });
    else if (next === "weekly")
      onChange({ kind: "weekly", days: [weekdayOf(startDate)] });
    else if (next === "monthly")
      onChange({ kind: "monthly", day: Number(startDate.slice(8, 10)) });
    else onChange({ kind: "yearly" });
  }

  function toggleDay(day: number) {
    if (value?.kind !== "weekly") return;
    const days = value.days.includes(day)
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort();
    // At least one day, or the routine would never come.
    if (days.length > 0) onChange({ kind: "weekly", days });
  }

  return (
    <div className="grid gap-2">
      <SimpleSelect
        value={kind}
        onChange={setKind}
        options={
          allowNever ? options : options.filter((o) => o.value !== NEVER)
        }
        label={text.dialog.repeat}
      />

      {value?.kind === "weekly" && (
        <div
          role="group"
          aria-label={text.repeat.daysOfWeek}
          className="flex gap-1"
        >
          {weekdayShort().map((label, day) => {
            const on = value.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(day)}
                className={cn(
                  "size-9 rounded-full border text-sm transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background can-hover:hover:bg-accent",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {value?.kind === "monthly" && (
        <label className="flex items-center gap-2 text-sm">
          {text.repeat.monthlyBefore}
          <Input
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            className="w-20"
            value={value.day}
            onChange={(e) => {
              const day = Math.min(31, Math.max(1, Number(e.target.value)));
              if (day) onChange({ kind: "monthly", day });
            }}
          />
          {text.repeat.monthlyAfter}
        </label>
      )}
    </div>
  );
}
