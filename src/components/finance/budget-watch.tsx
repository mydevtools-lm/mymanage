"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { budgetStatus, getMonthTransactions } from "@/lib/finance";
import { formatCurrency, toMonthKey } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * Speaks up once when this month's spending in a category crosses its
 * budget — from any screen, including the quick "+" on a phone. What was
 * already over when the app opened is not announced again.
 */
export function BudgetWatch() {
  const hydrated = useAppStore((s) => s.hydrated);
  const transactions = useAppStore((s) => s.transactions);
  const budgets = useAppStore((s) => s.settings.budgets);
  const categories = useAppStore((s) => s.categories);
  const over = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const month = toMonthKey(new Date());
    const lines = budgetStatus(
      getMonthTransactions(transactions, month),
      budgets,
    );
    const now = new Set(lines.filter((l) => l.over).map((l) => l.categoryId));
    if (over.current) {
      const m = t().finance.budgetWatch;
      for (const line of lines) {
        if (!line.over || over.current.has(line.categoryId)) continue;
        const name =
          categories.find((c) => c.id === line.categoryId)?.name ?? m.category;
        toast.warning(m.over(name), {
          description: m.detail(
            formatCurrency(line.spent),
            formatCurrency(line.budget),
          ),
        });
      }
    }
    over.current = now;
  }, [hydrated, transactions, budgets, categories]);

  return null;
}
