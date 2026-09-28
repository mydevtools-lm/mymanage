"use client";

import { CalendarRange, CalendarX2, Repeat } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMonth } from "@/lib/format";
import type { SeriesScope } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SCOPE_LABELS } from "./transaction-dialog";

const OPTIONS: {
  scope: SeriesScope;
  icon: typeof Repeat;
  hint: (month: string) => string;
}[] = [
  {
    scope: "this",
    icon: CalendarX2,
    hint: (m) => `רק ב${formatMonth(m)}. שאר החודשים לא משתנים.`,
  },
  {
    scope: "following",
    icon: CalendarRange,
    hint: (m) => `מ${formatMonth(m)} והלאה. החודשים שלפני נשארים כמו שהם.`,
  },
  {
    scope: "all",
    icon: Repeat,
    hint: () => "כל החודשים של הסדרה, גם אלה שכבר עברו.",
  },
];

/**
 * A recurring transaction appears in many months from one stored row. Before
 * an edit or delete, ask how far it should reach — the bug this replaced
 * silently applied every change to the whole series.
 */
export function SeriesScopeDialog({
  open,
  onOpenChange,
  action,
  description,
  month,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "edit" | "delete";
  description: string;
  month: string;
  onPick: (scope: SeriesScope) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === "delete" ? "מחיקת" : "עריכת"} ״{description}״
          </DialogTitle>
          <DialogDescription>
            זו תנועה חוזרת. על אילו חודשים זה חל?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {OPTIONS.map(({ scope, icon: Icon, hint }) => (
            <button
              key={scope}
              type="button"
              onClick={() => {
                onPick(scope);
                onOpenChange(false);
              }}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-start transition-colors can-hover:hover:bg-accent/50",
                action === "delete" &&
                  scope === "all" &&
                  "border-destructive/40 text-destructive",
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" />
              <span className="grid gap-0.5">
                <span className="font-medium">{SCOPE_LABELS[scope]}</span>
                <span className="text-xs text-muted-foreground">
                  {hint(month)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
