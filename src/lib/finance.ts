import {
  addMonths,
  differenceInCalendarMonths,
  getDaysInMonth,
  parseISO,
} from "date-fns";
import type { Category, Transaction } from "./types";
import { toMonthKey } from "./format";

export interface MonthTransaction extends Transaction {
  // True when this row is a projected instance of a recurring transaction.
  projected: boolean;
}

function dayOfMonth(dateKey: string) {
  return Number(dateKey.slice(8, 10));
}

// Returns the transactions that belong to a month, including projected
// instances of recurring transactions.
export function getMonthTransactions(
  transactions: Transaction[],
  monthKey: string,
): MonthTransaction[] {
  const monthStart = parseISO(`${monthKey}-01`);
  const daysInMonth = getDaysInMonth(monthStart);
  const rows: MonthTransaction[] = [];

  for (const t of transactions) {
    if (!t.recurring) {
      if (t.date.startsWith(monthKey)) rows.push({ ...t, projected: false });
      continue;
    }
    const { startMonth, endMonth } = t.recurring;
    if (monthKey < startMonth) continue;
    if (endMonth && monthKey > endMonth) continue;
    const day = Math.min(dayOfMonth(t.date), daysInMonth);
    rows.push({
      ...t,
      date: `${monthKey}-${String(day).padStart(2, "0")}`,
      projected: monthKey !== startMonth,
    });
  }

  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export interface MonthSummary {
  income: number;
  expense: number;
  balance: number;
}

export function summarize(rows: Transaction[]): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.type === "income") income += r.amount;
    else expense += r.amount;
  }
  return { income, expense, balance: income - expense };
}

export function categoryBreakdown(
  rows: Transaction[],
  categories: Category[],
  type: Transaction["type"],
) {
  const totals = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (r.type !== type) continue;
    const key = r.categoryId ?? "__none";
    totals.set(key, (totals.get(key) ?? 0) + r.amount);
    total += r.amount;
  }
  return [...totals.entries()]
    .map(([key, amount]) => ({
      category: categories.find((c) => c.id === key) ?? null,
      amount,
      share: total === 0 ? 0 : amount / total,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// Month keys from `from` up to and including `to`.
export function monthRange(from: string, to: string) {
  const start = parseISO(`${from}-01`);
  const end = parseISO(`${to}-01`);
  const count = Math.max(0, differenceInCalendarMonths(end, start));
  return Array.from({ length: count + 1 }, (_, i) =>
    toMonthKey(addMonths(start, i)),
  );
}

export function shiftMonth(monthKey: string, delta: number) {
  return toMonthKey(addMonths(parseISO(`${monthKey}-01`), delta));
}
