"use client";

import { addDays, format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toDateKey, todayKey } from "@/lib/format";

export function DayPicker({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const today = todayKey();
  const parsed = parseISO(date);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="יום קודם"
        onClick={() => onChange(toDateKey(addDays(parsed, -1)))}
      >
        <ChevronRight className="ltr:rotate-180" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="יום הבא"
        onClick={() => onChange(toDateKey(addDays(parsed, 1)))}
      >
        <ChevronLeft className="ltr:rotate-180" />
      </Button>
      {date !== today && (
        <Button variant="ghost" onClick={() => onChange(today)}>
          <Sun /> חזרה להיום
        </Button>
      )}
      <span className="ms-1 text-lg font-semibold">
        {date === today
          ? "היום"
          : format(parsed, "EEEE, d בMMMM", { locale: he })}
      </span>
      <span className="text-sm text-muted-foreground">
        {format(parsed, "d.M.yyyy")}
      </span>
      <Input
        type="date"
        aria-label="בחירת תאריך"
        value={date}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="ms-auto w-40"
      />
    </div>
  );
}
