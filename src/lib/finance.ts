import {
  addMonths,
  differenceInCalendarMonths,
  getDaysInMonth,
  parseISO,
} from "date-fns";
import type {
  Category,
  SeriesScope,
  Transaction,
  TransactionException,
} from "./types";
import { toMonthKey } from "./format";

export interface MonthTransaction extends Transaction {
  /** True when this row is a projected instance of a recurring transaction. */
  projected: boolean;
  /** True when this month's instance was edited on its own. */
  overridden: boolean;
}

function dayOfMonth(dateKey: string) {
  return Number(dateKey.slice(8, 10));
}

function exceptionFor(t: Transaction, monthKey: string) {
  return t.exceptions?.find((e) => e.month === monthKey);
}

/**
 * The transactions that belong to a month, including projected instances of
 * recurring transactions, with any per-month exception applied.
 */
export function getMonthTransactions(
  transactions: Transaction[],
  monthKey: string,
): MonthTransaction[] {
  const monthStart = parseISO(`${monthKey}-01`);
  const daysInMonth = getDaysInMonth(monthStart);
  const rows: MonthTransaction[] = [];

  for (const t of transactions) {
    if (!t.recurring) {
      if (t.date.startsWith(monthKey)) {
        rows.push({ ...t, projected: false, overridden: false });
      }
      continue;
    }

    const { startMonth, endMonth } = t.recurring;
    if (monthKey < startMonth) continue;
    if (endMonth && monthKey > endMonth) continue;

    const exception = exceptionFor(t, monthKey);
    if (exception?.skip) continue;

    const day = Math.min(dayOfMonth(t.date), daysInMonth);
    rows.push({
      ...t,
      amount: exception?.amount ?? t.amount,
      description: exception?.description ?? t.description,
      categoryId: exception?.categoryId ?? t.categoryId,
      date: `${monthKey}-${String(day).padStart(2, "0")}`,
      projected: monthKey !== startMonth,
      overridden: !!exception,
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

/** Month keys from `from` up to and including `to`. */
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

/* ------------------------------------------ editing a recurring series */

/**
 * What the store has to do to carry out an edit or delete on one month of a
 * recurring series. Kept pure so every scope can be unit-tested without a
 * database.
 */
export type SeriesPlan =
  | { kind: "delete"; id: string }
  | { kind: "update"; id: string; patch: Partial<Transaction> }
  | {
      kind: "split";
      id: string;
      patch: Partial<Transaction>;
      create: Omit<Transaction, "id" | "createdAt">;
    };

type Fields = Partial<
  Pick<Transaction, "amount" | "description" | "categoryId" | "type" | "notes">
>;

function withException(
  t: Transaction,
  month: string,
  change: Omit<TransactionException, "month">,
): TransactionException[] {
  const others = (t.exceptions ?? []).filter((e) => e.month !== month);
  const current = exceptionFor(t, month) ?? { month };
  return [...others, { ...current, ...change, month }].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
}

export function planSeriesDelete(
  t: Transaction,
  month: string,
  scope: SeriesScope,
): SeriesPlan {
  if (!t.recurring || scope === "all") return { kind: "delete", id: t.id };

  if (scope === "this") {
    return {
      kind: "update",
      id: t.id,
      patch: { exceptions: withException(t, month, { skip: true }) },
    };
  }

  // "following": stop the series the month before. Deleting from the very
  // first month leaves nothing, so the whole series goes.
  if (month <= t.recurring.startMonth) return { kind: "delete", id: t.id };
  return {
    kind: "update",
    id: t.id,
    patch: {
      recurring: { ...t.recurring, endMonth: shiftMonth(month, -1) },
      exceptions: (t.exceptions ?? []).filter((e) => e.month < month),
    },
  };
}

export function planSeriesEdit(
  t: Transaction,
  month: string,
  scope: SeriesScope,
  fields: Fields,
): SeriesPlan {
  if (!t.recurring || scope === "all") {
    return { kind: "update", id: t.id, patch: fields };
  }

  if (scope === "this") {
    const { amount, description, categoryId } = fields;
    return {
      kind: "update",
      id: t.id,
      patch: {
        exceptions: withException(t, month, {
          skip: undefined,
          ...(amount !== undefined && { amount }),
          ...(description !== undefined && { description }),
          ...(categoryId !== undefined && { categoryId }),
        }),
      },
    };
  }

  // "following" from the first month is the same as editing the whole series.
  if (month <= t.recurring.startMonth) {
    return { kind: "update", id: t.id, patch: fields };
  }

  // Split: the old series ends the month before; a new one starts here with
  // the new values and inherits the exceptions that fall inside it.
  const day = t.date.slice(8, 10);
  return {
    kind: "split",
    id: t.id,
    patch: {
      recurring: { ...t.recurring, endMonth: shiftMonth(month, -1) },
      exceptions: (t.exceptions ?? []).filter((e) => e.month < month),
    },
    create: {
      type: fields.type ?? t.type,
      amount: fields.amount ?? t.amount,
      description: fields.description ?? t.description,
      categoryId: fields.categoryId ?? t.categoryId,
      notes: fields.notes ?? t.notes,
      date: `${month}-${day}`,
      recurring: { startMonth: month, endMonth: t.recurring.endMonth },
      exceptions: (t.exceptions ?? []).filter((e) => e.month >= month),
    },
  };
}
