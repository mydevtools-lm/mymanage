"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { debtRemaining, debtsDueSoon } from "@/lib/finance";
import { formatCurrency, formatDate, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Debts past their date or due within the week. Nothing due, nothing shown. */
export function DebtsDueCard() {
  const debts = useAppStore((s) => s.debts);
  const today = todayKey();
  const due = useMemo(() => debtsDueSoon(debts, today), [debts, today]);
  if (due.length === 0) return null;

  const m = t().finance.debts;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.dueSoon}</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/finance?view=debts" />}
          >
            {m.all}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-2">
        {due.map((debt) => {
          const overdue = debt.dueDate! < today;
          return (
            <div
              key={debt.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{debt.person}</div>
                <div
                  className={cn(
                    "text-xs text-muted-foreground",
                    overdue && "font-medium text-expense",
                  )}
                >
                  {overdue
                    ? m.overdue(formatDate(debt.dueDate!))
                    : m.due(formatDate(debt.dueDate!))}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  debt.direction === "owe" ? "text-expense" : "text-income",
                )}
              >
                {formatCurrency(debtRemaining(debt))}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
