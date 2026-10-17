"use client";

import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toDateKey, todayKey } from "@/lib/format";
import { dateLocale, t } from "@/lib/i18n";

export function DayPicker({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const today = todayKey();
  const parsed = parseISO(date);
  const { common, today: text } = t();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={text.picker.previousDay}
        onClick={() => onChange(toDateKey(addDays(parsed, -1)))}
      >
        <ChevronRight className="ltr:rotate-180" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={text.picker.nextDay}
        onClick={() => onChange(toDateKey(addDays(parsed, 1)))}
      >
        <ChevronLeft className="ltr:rotate-180" />
      </Button>
      {date !== today && (
        <Button variant="ghost" onClick={() => onChange(today)}>
          <Sun /> {text.picker.backToToday}
        </Button>
      )}
      <span className="ms-1 text-lg font-semibold">
        {date === today
          ? common.today
          : format(parsed, text.dates.weekdayDayMonthLong, {
              locale: dateLocale(),
            })}
      </span>
      <span className="text-sm text-muted-foreground">
        {format(parsed, "d.M.yyyy")}
      </span>
      <Input
        type="date"
        aria-label={text.picker.pickDate}
        value={date}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="ms-auto w-40"
      />
    </div>
  );
}
