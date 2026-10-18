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
import { t } from "@/lib/i18n";
import { scopeLabels } from "./transaction-dialog";

const OPTIONS: {
  scope: SeriesScope;
  icon: typeof Repeat;
}[] = [
  { scope: "this", icon: CalendarX2 },
  { scope: "following", icon: CalendarRange },
  { scope: "all", icon: Repeat },
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
  const m = t().finance.scope;
  const labels = scopeLabels();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === "delete"
              ? m.deleteTitle(description)
              : m.editTitle(description)}
          </DialogTitle>
          <DialogDescription>{m.question}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {OPTIONS.map(({ scope, icon: Icon }) => (
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
                <span className="font-medium">{labels[scope]}</span>
                <span className="text-xs text-muted-foreground">
                  {m.hint[scope](formatMonth(month))}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
