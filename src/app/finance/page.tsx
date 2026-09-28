"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Repeat,
  Scale,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategorySelect, NONE } from "@/components/fields";
import {
  CategoryBadge,
  EmptyState,
  Hydrated,
  PageHeader,
} from "@/components/shared";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { RowActions } from "@/components/row-actions";
import { TrendChart } from "@/components/finance/trend-chart";
import { useAppStore } from "@/lib/store";
import {
  categoryBreakdown,
  getMonthTransactions,
  monthRange,
  shiftMonth,
  summarize,
} from "@/lib/finance";
import {
  formatCurrency,
  formatDate,
  formatMonth,
  toMonthKey,
} from "@/lib/format";
import { COLOR_STYLES } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "income" | "expense" | "balance";
}) {
  const color =
    tone === "income"
      ? "text-income"
      : tone === "expense"
        ? "text-expense"
        : value >= 0
          ? "text-income"
          : "text-expense";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className={cn("size-4", color)} />
          {title}
        </CardDescription>
        <CardTitle className={cn("text-2xl tabular-nums", color)}>
          {formatCurrency(value)}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export default function FinancePage() {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const startMonth = useAppStore((s) => s.settings.startMonth);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);

  const currentMonth = toMonthKey(new Date());
  const [month, setMonth] = useState(currentMonth);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryId, setCategoryId] = useState(NONE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const rows = useMemo(
    () => getMonthTransactions(transactions, month),
    [transactions, month],
  );
  const summary = useMemo(() => summarize(rows), [rows]);
  const filtered = rows.filter(
    (r) =>
      (typeFilter === "all" || r.type === typeFilter) &&
      (categoryId === NONE || r.categoryId === categoryId),
  );
  const breakdown = useMemo(
    () => categoryBreakdown(rows, categories, "expense"),
    [rows, categories],
  );

  const trend = useMemo(() => {
    const months = monthRange(startMonth, month).slice(-6);
    return months.map((m) => {
      const s = summarize(getMonthTransactions(transactions, m));
      return { month: m, income: s.income, expense: s.expense };
    });
  }, [transactions, startMonth, month]);

  const canGoBack = month > startMonth;

  return (
    <>
      <PageHeader
        title="כספים"
        description={`מעקב חודשי החל מ‑${formatMonth(startMonth)}`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            תנועה חדשה
          </Button>
        }
      />

      <Hydrated>
        <div className="mb-5 flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="חודש קודם"
            disabled={!canGoBack}
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="חודש הבא"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronLeft />
          </Button>
          {month !== currentMonth && (
            <Button variant="ghost" onClick={() => setMonth(currentMonth)}>
              החודש
            </Button>
          )}
          <h2 className="ms-2 text-lg font-semibold">{formatMonth(month)}</h2>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="הכנסות"
            value={summary.income}
            icon={ArrowUpRight}
            tone="income"
          />
          <SummaryCard
            title="הוצאות"
            value={summary.expense}
            icon={ArrowDownLeft}
            tone="expense"
          />
          <SummaryCard
            title="מאזן"
            value={summary.balance}
            icon={Scale}
            tone="balance"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>תנועות החודש</CardTitle>
                <div className="flex items-center gap-2">
                  <Tabs
                    value={typeFilter}
                    onValueChange={(v) => setTypeFilter(v as string)}
                  >
                    <TabsList>
                      <TabsTrigger value="all">הכול</TabsTrigger>
                      <TabsTrigger value="income">הכנסות</TabsTrigger>
                      <TabsTrigger value="expense">הוצאות</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <CategorySelect
                    kind="finance"
                    includeAll
                    className="w-40"
                    value={categoryId}
                    onChange={setCategoryId}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="אין תנועות בחודש זה"
                  hint="הוסף הכנסה או הוצאה כדי להתחיל"
                />
              ) : (
                <div className="divide-y">
                  {filtered.map((r) => {
                    const category = categories.find(
                      (c) => c.id === r.categoryId,
                    );
                    const income = r.type === "income";
                    return (
                      <div
                        key={r.id}
                        className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full",
                            income
                              ? "bg-income/15 text-income"
                              : "bg-expense/15 text-expense",
                          )}
                        >
                          {income ? (
                            <ArrowUpRight className="size-4" />
                          ) : (
                            <ArrowDownLeft className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {r.description}
                            </span>
                            {r.recurring && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Repeat className="size-3.5 text-muted-foreground" />
                                  }
                                />
                                <TooltipContent>
                                  {r.projected
                                    ? "תנועה חוזרת (משוערת)"
                                    : "תנועה חוזרת"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {formatDate(r.date)}
                            <CategoryBadge category={category} />
                          </div>
                        </div>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            income ? "text-income" : "text-expense",
                          )}
                        >
                          {income ? "+" : "−"}
                          {formatCurrency(r.amount)}
                        </span>
                        <RowActions
                          actions={[
                            {
                              label: "עריכה",
                              icon: Pencil,
                              onSelect: () => {
                                setEditing(
                                  transactions.find((t) => t.id === r.id) ??
                                    null,
                                );
                                setDialogOpen(true);
                              },
                            },
                            {
                              label: "מחיקה",
                              icon: Trash2,
                              destructive: true,
                              onSelect: () => deleteTransaction(r.id),
                            },
                          ]}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 content-start">
            <Card>
              <CardHeader>
                <CardTitle>הוצאות לפי קטגוריה</CardTitle>
                <CardDescription>{formatMonth(month)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {breakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    אין הוצאות החודש.
                  </p>
                )}
                {breakdown.map(({ category, amount, share }) => (
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
                          <span className="text-muted-foreground">
                            ללא קטגוריה
                          </span>
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

            <Card>
              <CardHeader>
                <CardTitle>מגמה</CardTitle>
                <CardDescription>
                  הכנסות מול הוצאות, עד 6 חודשים אחרונים
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart data={trend} />
              </CardContent>
            </Card>
          </div>
        </div>
      </Hydrated>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
        defaultDate={month === currentMonth ? undefined : `${month}-01`}
      />
    </>
  );
}
