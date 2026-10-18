"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryChips, Field, NONE } from "@/components/fields";
import { useAppStore } from "@/lib/store";
import { formatMonth, todayKey } from "@/lib/format";
import { suggestCategory } from "@/lib/bank-import";
import { LinksSection } from "@/components/links-section";
import type { MonthTransaction } from "@/lib/finance";
import type { SeriesScope, Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export const scopeLabels = (): Record<SeriesScope, string> =>
  t().finance.scope.labels;

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultDate?: string;
  /** Editing one month of a recurring series, with the reach already chosen. */
  series?: { row: MonthTransaction; month: string; scope: SeriesScope } | null;
}

// The form lives in its own component so its state resets every time the
// dialog content mounts (base-ui unmounts the popup when closed).
export function TransactionDialog(props: TransactionDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <TransactionForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  onOpenChange,
  transaction,
  defaultDate,
  series,
}: TransactionDialogProps) {
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const editInSeries = useAppStore((s) => s.editTransactionInSeries);
  const categories = useAppStore((s) => s.categories);
  const history = useAppStore((s) => s.transactions);

  // In a series edit the form starts from what that month actually shows,
  // including any earlier one-month override.
  const source: Partial<Transaction> | null | undefined = series
    ? series.row
    : transaction;
  const onlyThisMonth = series?.scope === "this";

  const [type, setType] = useState<TransactionType>(source?.type ?? "expense");
  const [amount, setAmount] = useState(
    source?.amount !== undefined ? String(source.amount) : "",
  );
  const [description, setDescription] = useState(source?.description ?? "");
  const [date, setDate] = useState(
    transaction?.date ?? defaultDate ?? todayKey(),
  );
  const [categoryId, setCategoryId] = useState(source?.categoryId ?? NONE);
  // A new entry picks its category from how the same description was filed
  // before — until the person picks one themselves.
  const [categoryPicked, setCategoryPicked] = useState(!!source);
  const describe = (value: string) => {
    setDescription(value);
    if (categoryPicked) return;
    setCategoryId(suggestCategory(value, history, type) ?? NONE);
  };
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [recurring, setRecurring] = useState(!!transaction?.recurring);
  const [endMonth, setEndMonth] = useState(
    transaction?.recurring?.endMonth ?? "",
  );

  const m = t().finance;
  const tm = m.transaction;
  const common = t().common;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(tm.needAmount);
      return;
    }
    const category = categoryId === NONE ? undefined : categoryId;
    // The description is optional: fall back to the category, then the type.
    const label =
      description.trim() ||
      categories.find((c) => c.id === category)?.name ||
      (type === "income" ? tm.income : tm.expense);

    if (series) {
      editInSeries(series.row.id, series.month, series.scope, {
        amount: value,
        description: label,
        categoryId: category,
        ...(onlyThisMonth ? {} : { type, notes: notes.trim() || undefined }),
      });
      toast.success(tm.updatedScope(scopeLabels()[series.scope]));
      onOpenChange(false);
      return;
    }

    if (!date) {
      toast.error(tm.needDate);
      return;
    }
    const input = {
      type,
      amount: value,
      description: label,
      date,
      categoryId: category,
      notes: notes.trim() || undefined,
      recurring: recurring
        ? { startMonth: date.slice(0, 7), endMonth: endMonth || undefined }
        : undefined,
    };
    if (transaction) {
      updateTransaction(transaction.id, input);
      toast.success(tm.updated);
    } else {
      addTransaction(input);
      toast.success(type === "income" ? tm.incomeAdded : tm.expenseAdded);
    }
    onOpenChange(false);
  }

  const title = series
    ? tm.editRecurring
    : transaction
      ? tm.edit
      : m.newTransaction;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {series && (
          <DialogDescription>
            {scopeLabels()[series.scope]}
            {series.scope !== "all" && tm.fromMonth(formatMonth(series.month))}
          </DialogDescription>
        )}
      </DialogHeader>

      {!onlyThisMonth && (
        <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
          <TabsList className="w-full">
            <TabsTrigger value="expense" className="data-active:text-expense">
              {tm.expense}
            </TabsTrigger>
            <TabsTrigger value="income" className="data-active:text-income">
              {tm.income}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Amount first and large: it is the one thing every entry needs. */}
      <Field label={tm.amount} htmlFor="tx-amount">
        <Input
          id="tx-amount"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          enterKeyHint="next"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={cn(
            "h-12 text-2xl font-semibold tabular-nums md:text-2xl",
            type === "income" ? "text-income" : "text-expense",
          )}
          autoFocus
        />
      </Field>

      <Field label={m.category}>
        <CategoryChips
          kind="finance"
          value={categoryId}
          onChange={(id) => {
            setCategoryPicked(true);
            setCategoryId(id);
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tm.descriptionOptional} htmlFor="tx-desc">
          <Input
            id="tx-desc"
            value={description}
            onChange={(e) => describe(e.target.value)}
            placeholder={
              type === "income" ? tm.incomeExample : tm.expenseExample
            }
          />
        </Field>
        {!series && (
          <Field label={m.date} htmlFor="tx-date">
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        )}
      </div>

      {!series && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <Switch
              id="tx-recurring"
              checked={recurring}
              onCheckedChange={setRecurring}
            />
            <Label htmlFor="tx-recurring">{tm.recurring}</Label>
          </div>
          {recurring && (
            <div className="mt-3 grid gap-1.5">
              <Label htmlFor="tx-end">{tm.untilMonth}</Label>
              <Input
                id="tx-end"
                type="month"
                value={endMonth}
                min={date.slice(0, 7)}
                onChange={(e) => setEndMonth(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {tm.recurringHint(date.slice(0, 7))}
              </p>
            </div>
          )}
        </div>
      )}

      {!onlyThisMonth && (
        <Field label={m.notes} htmlFor="tx-notes">
          <Textarea
            id="tx-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      )}

      {(transaction || series) && (
        <LinksSection
          kind="transaction"
          id={transaction?.id ?? series!.row.id}
          onLeave={() => onOpenChange(false)}
        />
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          {common.cancel}
        </Button>
        <Button type="submit">
          {transaction || series ? common.save : common.add}
        </Button>
      </DialogFooter>
    </form>
  );
}
