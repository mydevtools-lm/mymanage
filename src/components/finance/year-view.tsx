"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { categoryBreakdown, yearSummary } from "@/lib/finance";
import { formatCurrency, formatMonth } from "@/lib/format";
import { COLOR_STYLES } from "@/lib/colors";
import { cn } from "@/lib/utils";

/**
 * A whole year: twelve months side by side with totals, and where the money
 * went by category. A month opens the month view.
 */
export function YearView({
  year,
  onYearChange,
  onOpenMonth,
  currentMonth,
}: {
  year: number;
  onYearChange: (year: number) => void;
  onOpenMonth: (month: string) => void;
  currentMonth: string;
}) {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);

  const { months, total, rows } = useMemo(
    () => yearSummary(transactions, year),
    [transactions, year],
  );
  const byCategory = useMemo(
    () => categoryBreakdown(rows, categories, "expense"),
    [rows, categories],
  );
  const busiest = Math.max(
    1,
    ...months.map((m) => Math.max(m.income, m.expense)),
  );

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="השנה הקודמת"
          onClick={() => onYearChange(year - 1)}
        >
          <ChevronRight className="ltr:rotate-180" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="השנה הבאה"
          onClick={() => onYearChange(year + 1)}
        >
          <ChevronLeft className="ltr:rotate-180" />
        </Button>
        <h2 className="text-lg font-semibold tabular-nums">{year}</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>חודש אחר חודש</CardTitle>
            <CardDescription>לחיצה על חודש פותחת אותו</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-start font-medium">חודש</th>
                  <th className="py-2 text-end font-medium">הכנסות</th>
                  <th className="py-2 text-end font-medium">הוצאות</th>
                  <th className="py-2 text-end font-medium">מאזן</th>
                  <th className="hidden w-32 py-2 sm:table-cell">
                    <span className="sr-only">השוואה</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const empty = m.income === 0 && m.expense === 0;
                  return (
                    <tr
                      key={m.month}
                      className={cn(
                        "border-b last:border-0",
                        m.month === currentMonth && "bg-accent/50",
                      )}
                    >
                      <td className="py-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenMonth(m.month)}
                          className="rounded text-start underline-offset-4 hover:underline"
                        >
                          {formatMonth(m.month).replace(` ${year}`, "")}
                        </button>
                      </td>
                      <td className="py-1.5 text-end text-income tabular-nums">
                        {empty ? "—" : formatCurrency(m.income)}
                      </td>
                      <td className="py-1.5 text-end text-expense tabular-nums">
                        {empty ? "—" : formatCurrency(m.expense)}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-end font-medium tabular-nums",
                          m.balance >= 0 ? "text-income" : "text-expense",
                        )}
                      >
                        {empty ? "—" : formatCurrency(m.balance)}
                      </td>
                      <td className="hidden py-1.5 ps-3 sm:table-cell">
                        <div className="grid gap-0.5" aria-hidden>
                          <div
                            className="h-1.5 rounded-full bg-income/70"
                            style={{ width: `${(m.income / busiest) * 100}%` }}
                          />
                          <div
                            className="h-1.5 rounded-full bg-expense/70"
                            style={{ width: `${(m.expense / busiest) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2">סה״כ</td>
                  <td className="py-2 text-end text-income tabular-nums">
                    {formatCurrency(total.income)}
                  </td>
                  <td className="py-2 text-end text-expense tabular-nums">
                    {formatCurrency(total.expense)}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-end tabular-nums",
                      total.balance >= 0 ? "text-income" : "text-expense",
                    )}
                  >
                    {formatCurrency(total.balance)}
                  </td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>לאן הלך הכסף</CardTitle>
            <CardDescription>הוצאות {year} לפי קטגוריה</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {byCategory.length === 0 && (
              <p className="text-sm text-muted-foreground">אין הוצאות השנה.</p>
            )}
            {byCategory.map(({ category, amount, share }) => (
              <div key={category?.id ?? "none"} className="grid gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {category ? (
                      <>
                        <span
                          className={cn(
                            "size-2.5 rounded-full",
                            COLOR_STYLES[category.color].dot,
                          )}
                        />
                        {category.name}
                      </>
                    ) : (
                      <span className="text-muted-foreground">ללא קטגוריה</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(amount)}
                    <span className="ms-1.5 text-xs text-muted-foreground">
                      {Math.round(share * 100)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      category
                        ? COLOR_STYLES[category.color].dot
                        : "bg-slate-400",
                    )}
                    style={{ width: `${Math.max(2, share * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
