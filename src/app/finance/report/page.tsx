"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hydrated } from "@/components/shared";
import { useAppStore } from "@/lib/store";
import {
  budgetStatus,
  categoryBreakdown,
  getMonthTransactions,
  summarize,
  yearSummary,
} from "@/lib/finance";
import {
  formatCurrency,
  formatDate,
  formatMonth,
  todayKey,
  toMonthKey,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A plain report of one month (?month=yyyy-MM) or one year (?year=yyyy),
 * laid out for paper: the browser's print dialog saves it as a PDF.
 */
function Report() {
  const params = useSearchParams();
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const budgets = useAppStore((s) => s.settings.budgets);

  const year = params.get("year");
  const month = params.get("month") ?? toMonthKey(new Date());
  const title = year ? `דוח שנתי ${year}` : `דוח חודשי — ${formatMonth(month)}`;
  const back = year ? "/finance?view=year" : `/finance?month=${month}`;

  const rows = useMemo(
    () =>
      year
        ? yearSummary(transactions, Number(year)).rows
        : getMonthTransactions(transactions, month),
    [transactions, year, month],
  );
  const summary = summarize(rows);
  const expenses = categoryBreakdown(rows, categories, "expense");
  const income = categoryBreakdown(rows, categories, "income");
  const overBudget = year
    ? []
    : budgetStatus(rows, budgets).filter((b) => b.over);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <article className="mx-auto grid max-w-3xl gap-6 text-sm print:max-w-none print:text-[11pt]">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={back} />}
        >
          <ArrowRight />
          חזרה לכספים
        </Button>
        <Button onClick={() => window.print()}>
          <Printer />
          הדפסה / שמירה כ‑PDF
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">הופק ב־{formatDate(todayKey())}</p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "הכנסות", value: summary.income, tone: "text-income" },
          { label: "הוצאות", value: summary.expense, tone: "text-expense" },
          {
            label: "מאזן",
            value: summary.balance,
            tone: summary.balance >= 0 ? "text-income" : "text-expense",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border p-3">
            <div className="text-muted-foreground">{card.label}</div>
            <div
              className={cn("text-xl font-semibold tabular-nums", card.tone)}
            >
              {formatCurrency(card.value)}
            </div>
          </div>
        ))}
      </section>

      {overBudget.length > 0 && (
        <section className="rounded-lg border border-destructive/40 p-3 text-destructive">
          חריגה מהתקציב:{" "}
          {overBudget
            .map(
              (b) =>
                `${names.get(b.categoryId) ?? "?"} (${formatCurrency(b.spent)} מתוך ${formatCurrency(b.budget)})`,
            )
            .join(" · ")}
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        {[
          { heading: "הוצאות לפי קטגוריה", list: expenses },
          { heading: "הכנסות לפי קטגוריה", list: income },
        ].map(({ heading, list }) => (
          <div key={heading}>
            <h2 className="mb-2 font-semibold">{heading}</h2>
            {list.length === 0 ? (
              <p className="text-muted-foreground">אין.</p>
            ) : (
              <table className="w-full">
                <tbody>
                  {list.map(({ category, amount, share }) => (
                    <tr key={category?.id ?? "none"} className="border-b">
                      <td className="py-1">
                        {category?.name ?? "ללא קטגוריה"}
                      </td>
                      <td className="py-1 text-end tabular-nums">
                        {formatCurrency(amount)}
                      </td>
                      <td className="w-12 py-1 text-end text-muted-foreground tabular-nums">
                        {Math.round(share * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">תנועות ({sorted.length})</h2>
        <table className="w-full">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 text-start font-medium">תאריך</th>
              <th className="py-1 text-start font-medium">תיאור</th>
              <th className="py-1 text-start font-medium">קטגוריה</th>
              <th className="py-1 text-end font-medium">סכום</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={`${r.id}-${i}`} className="border-b break-inside-avoid">
                <td className="py-1 whitespace-nowrap tabular-nums">
                  {formatDate(r.date)}
                </td>
                <td className="py-1">{r.description}</td>
                <td className="py-1 text-muted-foreground">
                  {(r.categoryId && names.get(r.categoryId)) || "—"}
                </td>
                <td
                  className={cn(
                    "py-1 text-end whitespace-nowrap tabular-nums",
                    r.type === "income" ? "text-income" : "text-expense",
                  )}
                >
                  {r.type === "income" ? "+" : "−"}
                  {formatCurrency(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}

export default function ReportPage() {
  return (
    <Hydrated>
      <Suspense>
        <Report />
      </Suspense>
    </Hydrated>
  );
}
