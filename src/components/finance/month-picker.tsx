"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMonth } from "@/lib/format";
import { shiftMonth } from "@/lib/finance";
import { cn } from "@/lib/utils";

/**
 * Arrows for the next/previous month, and the month name opens a year grid
 * to jump straight there. Nothing before the month tracking started.
 */
export function MonthPicker({
  month,
  onChange,
  minMonth,
  currentMonth,
}: {
  month: string;
  onChange: (month: string) => void;
  minMonth: string;
  currentMonth: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const minYear = Number(minMonth.slice(0, 4));

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="חודש קודם"
        disabled={month <= minMonth}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronRight className="ltr:rotate-180" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="חודש הבא"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronLeft className="ltr:rotate-180" />
      </Button>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setYear(Number(month.slice(0, 4)));
        }}
      >
        <PopoverTrigger
          render={<Button variant="ghost" className="text-lg font-semibold" />}
        >
          {formatMonth(month)}
          <ChevronDown className="size-4 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="שנה קודמת"
              disabled={year <= minYear}
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronRight className="ltr:rotate-180" />
            </Button>
            <span className="font-semibold tabular-nums">{year}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="שנה הבאה"
              onClick={() => setYear((y) => y + 1)}
            >
              <ChevronLeft className="ltr:rotate-180" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              const disabled = key < minMonth;
              return (
                <Button
                  key={key}
                  size="sm"
                  variant={key === month ? "default" : "ghost"}
                  disabled={disabled}
                  className={cn(
                    key === currentMonth &&
                      key !== month &&
                      "ring-1 ring-primary/50",
                  )}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  {format(parseISO(`${key}-01`), "MMM", { locale: he })}
                </Button>
              );
            })}
          </div>
          {month !== currentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onChange(currentMonth);
                setOpen(false);
              }}
            >
              לחודש הנוכחי
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
