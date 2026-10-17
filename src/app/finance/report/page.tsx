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
import { t } from "@/lib/i18n";

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
  const back = year ? "/finance?view=year" : `/finance?month=${month}`;

  const rows = useMemo(
    () =>
      year
        ? yearSummary(transactions, Number(year)).rows
        : getMonthTransactions(transactions, month),
    [transactions, year, month],
  );
  const m = t().finance;
  const title = year
    ? m.report.yearly(year)
    : m.report.monthly(formatMonth(month));
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
          <ArrowRight className="ltr:rotate-180" />
          {m.report.back}
        </Button>
        <Button onClick={() => window.print()}>
          <Printer />
          {m.report.print}
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">
          {m.report.generated(formatDate(todayKey()))}
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: m.income, value: summary.income, tone: "text-income" },
          { label: m.expenses, value: summary.expense, tone: "text-expense" },
          {
            label: m.balance,
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
          {m.report.overBudget}{" "}
          {overBudget
            .map((b) =>
              m.report.overLine(
                names.get(b.categoryId) ?? "?",
                formatCurrency(b.spent),
                formatCurrency(b.budget),
              ),
            )
            .join(" · ")}
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        {[
          { heading: m.report.expensesByCategory, list: expenses },
          { heading: m.report.incomeByCategory, list: income },
        ].map(({ heading, list }) => (
          <div key={heading}>
            <h2 className="mb-2 font-semibold">{heading}</h2>
            {list.length === 0 ? (
              <p className="text-muted-foreground">{m.report.none}</p>
            ) : (
              <table className="w-full">
                <tbody>
                  {list.map(({ category, amount, share }) => (
                    <tr key={category?.id ?? "none"} className="border-b">
                      <td className="py-1">{category?.name ?? m.noCategory}</td>
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
        <h2 className="mb-2 font-semibold">
          {m.report.transactions(sorted.length)}
        </h2>
        <table className="w-full">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 text-start font-medium">{m.date}</th>
              <th className="py-1 text-start font-medium">{m.description}</th>
              <th className="py-1 text-start font-medium">{m.category}</th>
              <th className="py-1 text-end font-medium">{m.amount}</th>
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
