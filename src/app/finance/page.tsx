"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileText,
  FileUp,
  PiggyBank,
  Pencil,
  Plus,
  Repeat,
  Scale,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImportDialog } from "@/components/finance/import-dialog";
import { BudgetDialog } from "@/components/finance/budget-dialog";
import { YearView } from "@/components/finance/year-view";
import { CategorySelect, NONE } from "@/components/fields";
import {
  CategoryBadge,
  EmptyState,
  Hydrated,
  PageHeader,
} from "@/components/shared";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { SeriesScopeDialog } from "@/components/finance/series-scope-dialog";
import { MonthPicker } from "@/components/finance/month-picker";
import { RowActions } from "@/components/row-actions";
import { TrendChart } from "@/components/finance/trend-chart";
import { useAppStore } from "@/lib/store";
import {
  budgetStatus,
  categoryBreakdown,
  getMonthTransactions,
  monthRange,
  summarize,
  transactionsToCsv,
  yearSummary,
  type MonthTransaction,
} from "@/lib/finance";
import {
  formatCurrency,
  formatDate,
  formatMonth,
  toMonthKey,
} from "@/lib/format";
import { COLOR_STYLES } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { SeriesScope, Transaction, TransactionType } from "@/lib/types";

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
        <CardTitle className={cn("text-xl tabular-nums sm:text-2xl", color)}>
          {formatCurrency(value)}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

type Pending = { action: "edit" | "delete"; row: MonthTransaction };

function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// Back from the printable report lands on the same month or year. The views
// render only after the store hydrates, so reading the address here can't
// make the server and client disagree.
function fromAddress(name: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function FinancePage() {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const startMonth = useAppStore((s) => s.settings.startMonth);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const deleteInSeries = useAppStore((s) => s.deleteTransactionInSeries);

  const budgets = useAppStore((s) => s.settings.budgets);

  const currentMonth = toMonthKey(new Date());
  const [month, setMonth] = useState(
    () => fromAddress("month") ?? currentMonth,
  );
  const [view, setView] = useState(() =>
    fromAddress("view") === "year" ? "year" : "month",
  );
  const [year, setYear] = useState(() => Number(month.slice(0, 4)));
  const [importOpen, setImportOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryId, setCategoryId] = useState(NONE);
  const [query, setQuery] = useState("");
  const [breakdownType, setBreakdownType] =
    useState<TransactionType>("expense");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [seriesEdit, setSeriesEdit] = useState<{
    row: MonthTransaction;
    month: string;
    scope: SeriesScope;
  } | null>(null);
  // Open state is kept apart from the data, so the dialog keeps its text
  // while it animates closed instead of flashing an empty title.
  const [pending, setPending] = useState<Pending | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const askScope = (next: Pending) => {
    setPending(next);
    setScopeOpen(true);
  };

  const rows = useMemo(
    () => getMonthTransactions(transactions, month),
    [transactions, month],
  );
  const summary = useMemo(() => summarize(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (typeFilter === "all" || r.type === typeFilter) &&
        (categoryId === NONE || r.categoryId === categoryId) &&
        // Matches the description, or digits of the amount ("450" finds 4,500).
        (!q ||
          r.description.toLowerCase().includes(q) ||
          String(r.amount).includes(q.replace(/[,₪\s]/g, ""))),
    );
  }, [rows, typeFilter, categoryId, query]);

  const breakdown = useMemo(
    () => categoryBreakdown(rows, categories, breakdownType),
    [rows, categories, breakdownType],
  );
  const budgetLines = useMemo(
    () => new Map(budgetStatus(rows, budgets).map((b) => [b.categoryId, b])),
    [rows, budgets],
  );
  // Budgeted categories with nothing spent yet still show their room.
  const unspentBudgets = [...budgetLines.values()].filter(
    (b) => !breakdown.some((row) => row.category?.id === b.categoryId),
  );

  const exportCsv = () => {
    if (view === "year") {
      downloadCsv(
        `כספים-${year}.csv`,
        transactionsToCsv(yearSummary(transactions, year).rows, categories),
      );
    } else {
      downloadCsv(`כספים-${month}.csv`, transactionsToCsv(rows, categories));
    }
  };
  const reportHref =
    view === "year"
      ? `/finance/report?year=${year}`
      : `/finance/report?month=${month}`;

  const trend = useMemo(() => {
    const months = monthRange(startMonth, month).slice(-6);
    return months.map((m) => {
      const s = summarize(getMonthTransactions(transactions, m));
      return { month: m, income: s.income, expense: s.expense };
    });
  }, [transactions, startMonth, month]);

  const openNew = () => {
    setEditing(null);
    setSeriesEdit(null);
    setDialogOpen(true);
  };

  // One-off rows act directly. Recurring rows first ask how far to reach.
  const requestEdit = (row: MonthTransaction) => {
    if (row.recurring) {
      askScope({ action: "edit", row });
      return;
    }
    setSeriesEdit(null);
    setEditing(transactions.find((t) => t.id === row.id) ?? null);
    setDialogOpen(true);
  };
  const requestDelete = (row: MonthTransaction) => {
    if (row.recurring) askScope({ action: "delete", row });
    else deleteTransaction(row.id);
  };

  const applyScope = (scope: SeriesScope) => {
    if (!pending) return;
    const { action, row } = pending;
    if (action === "delete") {
      deleteInSeries(row.id, month, scope);
      return;
    }
    if (scope === "all") {
      // The whole series is the stored row itself: the full form applies.
      setSeriesEdit(null);
      setEditing(transactions.find((t) => t.id === row.id) ?? null);
    } else {
      setEditing(null);
      setSeriesEdit({ row, month, scope });
    }
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="כספים"
        description={`מעקב חודשי החל מ‑${formatMonth(startMonth)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp />
              <span className="max-sm:sr-only">ייבוא</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <Download />
                <span className="max-sm:sr-only">ייצוא</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onClick={exportCsv}>
                  <Download />
                  {view === "year" ? `CSV של ${year}` : "CSV של החודש"}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={reportHref} />}>
                  <FileText />
                  דוח להדפסה / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={openNew}>
              <Plus />
              תנועה חדשה
            </Button>
          </>
        }
      />

      <Hydrated>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {view === "month" ? (
            <MonthPicker
              month={month}
              onChange={setMonth}
              minMonth={startMonth}
              currentMonth={currentMonth}
            />
          ) : (
            <span />
          )}
          <Tabs value={view} onValueChange={(v) => setView(v as string)}>
            <TabsList>
              <TabsTrigger value="month">חודש</TabsTrigger>
              <TabsTrigger value="year">שנה</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {view === "year" ? (
          <YearView
            year={year}
            onYearChange={setYear}
            currentMonth={currentMonth}
            onOpenMonth={(m) => {
              setMonth(m);
              setView("month");
            }}
          />
        ) : (
          <>
            <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
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
                <CardHeader className="gap-3">
                  <CardTitle>תנועות החודש</CardTitle>
                  <div className="col-span-full flex flex-wrap items-center gap-2">
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
                    <div className="relative min-w-40 flex-1">
                      <Search className="absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="ps-8"
                        data-search
                        placeholder="חיפוש תיאור או סכום..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filtered.length === 0 ? (
                    <EmptyState
                      icon={Wallet}
                      title={
                        rows.length === 0
                          ? "אין תנועות בחודש זה"
                          : "לא נמצאו תנועות"
                      }
                      hint={
                        rows.length === 0
                          ? "הכנסה או הוצאה ראשונה לחודש הזה"
                          : "נסה לשנות את החיפוש או הסינון"
                      }
                      action={
                        rows.length === 0
                          ? { label: "תנועה חדשה", onClick: openNew }
                          : undefined
                      }
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
                                  <Repeat
                                    className="size-3.5 shrink-0 text-muted-foreground"
                                    aria-label={
                                      r.overridden
                                        ? "תנועה חוזרת, שונתה החודש"
                                        : "תנועה חוזרת"
                                    }
                                  />
                                )}
                                {r.overridden && (
                                  <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                                    שונה החודש
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                                  onSelect: () => requestEdit(r),
                                },
                                {
                                  label: "מחיקה",
                                  icon: Trash2,
                                  destructive: true,
                                  onSelect: () => requestDelete(r),
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

              <div className="grid content-start gap-6">
                <Card>
                  <CardHeader className="gap-2">
                    <CardTitle>פילוח לפי קטגוריה</CardTitle>
                    <CardDescription>{formatMonth(month)}</CardDescription>
                    <CardAction>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBudgetOpen(true)}
                      >
                        <PiggyBank />
                        תקציב
                      </Button>
                    </CardAction>
                    <Tabs
                      className="col-span-full"
                      value={breakdownType}
                      onValueChange={(v) =>
                        setBreakdownType(v as TransactionType)
                      }
                    >
                      <TabsList className="w-full">
                        <TabsTrigger
                          value="expense"
                          className="data-active:text-expense"
                        >
                          הוצאות
                        </TabsTrigger>
                        <TabsTrigger
                          value="income"
                          className="data-active:text-income"
                        >
                          הכנסות
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {breakdown.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {breakdownType === "expense"
                          ? "אין הוצאות החודש."
                          : "אין הכנסות החודש."}
                      </p>
                    )}
                    {breakdown.map(({ category, amount, share }) => {
                      const budget =
                        breakdownType === "expense" && category
                          ? budgetLines.get(category.id)
                          : undefined;
                      return (
                        <div
                          key={category?.id ?? "none"}
                          className="grid gap-1"
                        >
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
                            <span
                              className={cn(
                                "tabular-nums",
                                budget?.over && "font-medium text-destructive",
                              )}
                            >
                              {formatCurrency(amount)}
                              <span className="ms-1.5 text-xs text-muted-foreground">
                                {budget
                                  ? `מתוך ${formatCurrency(budget.budget)}`
                                  : `${Math.round(share * 100)}%`}
                              </span>
                            </span>
                          </div>
                          <div
                            className="h-1.5 overflow-hidden rounded-full bg-muted"
                            role={budget ? "meter" : undefined}
                            aria-label={
                              budget ? `תקציב ${category?.name}` : undefined
                            }
                            aria-valuemin={budget ? 0 : undefined}
                            aria-valuemax={budget?.budget}
                            aria-valuenow={budget ? budget.spent : undefined}
                          >
                            <div
                              className={cn(
                                "h-full rounded-full",
                                budget?.over
                                  ? "bg-destructive"
                                  : category
                                    ? COLOR_STYLES[category.color].dot
                                    : "bg-slate-400",
                              )}
                              style={{
                                width: `${Math.max(
                                  2,
                                  Math.min(
                                    100,
                                    (budget ? budget.ratio : share) * 100,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                          {budget?.over && (
                            <span className="text-xs text-destructive">
                              חריגה של{" "}
                              {formatCurrency(budget.spent - budget.budget)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {breakdownType === "expense" &&
                      unspentBudgets.map((b) => {
                        const category = categories.find(
                          (c) => c.id === b.categoryId,
                        );
                        if (!category) return null;
                        return (
                          <div
                            key={b.categoryId}
                            className="flex items-center justify-between text-sm text-muted-foreground"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "size-2.5 rounded-full",
                                  COLOR_STYLES[category.color].dot,
                                )}
                              />
                              {category.name}
                            </span>
                            <span className="tabular-nums">
                              ₪0 מתוך {formatCurrency(b.budget)}
                            </span>
                          </div>
                        );
                      })}
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
          </>
        )}
      </Hydrated>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <BudgetDialog open={budgetOpen} onOpenChange={setBudgetOpen} />

      <SeriesScopeDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        action={pending?.action ?? "edit"}
        description={pending?.row.description ?? ""}
        month={month}
        onPick={applyScope}
      />

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
        series={seriesEdit}
        defaultDate={month === currentMonth ? undefined : `${month}-01`}
      />
    </>
  );
}
