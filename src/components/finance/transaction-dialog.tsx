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
import type { MonthTransaction } from "@/lib/finance";
import type { SeriesScope, Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const SCOPE_LABELS: Record<SeriesScope, string> = {
  this: "רק החודש הזה",
  following: "מהחודש הזה והלאה",
  all: "כל הסדרה",
};

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
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [recurring, setRecurring] = useState(!!transaction?.recurring);
  const [endMonth, setEndMonth] = useState(
    transaction?.recurring?.endMonth ?? "",
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("צריך סכום חיובי");
      return;
    }
    const category = categoryId === NONE ? undefined : categoryId;
    // The description is optional: fall back to the category, then the type.
    const label =
      description.trim() ||
      categories.find((c) => c.id === category)?.name ||
      (type === "income" ? "הכנסה" : "הוצאה");

    if (series) {
      editInSeries(series.row.id, series.month, series.scope, {
        amount: value,
        description: label,
        categoryId: category,
        ...(onlyThisMonth ? {} : { type, notes: notes.trim() || undefined }),
      });
      toast.success(`עודכן — ${SCOPE_LABELS[series.scope]}`);
      onOpenChange(false);
      return;
    }

    if (!date) {
      toast.error("צריך תאריך");
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
      toast.success("התנועה עודכנה");
    } else {
      addTransaction(input);
      toast.success(type === "income" ? "ההכנסה נוספה" : "ההוצאה נוספה");
    }
    onOpenChange(false);
  }

  const title = series
    ? "עריכת תנועה חוזרת"
    : transaction
      ? "עריכת תנועה"
      : "תנועה חדשה";

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {series && (
          <DialogDescription>
            {SCOPE_LABELS[series.scope]}
            {series.scope !== "all" && ` · מ${formatMonth(series.month)}`}
          </DialogDescription>
        )}
      </DialogHeader>

      {!onlyThisMonth && (
        <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
          <TabsList className="w-full">
            <TabsTrigger value="expense" className="data-active:text-expense">
              הוצאה
            </TabsTrigger>
            <TabsTrigger value="income" className="data-active:text-income">
              הכנסה
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Amount first and large: it is the one thing every entry needs. */}
      <Field label="סכום (₪)" htmlFor="tx-amount">
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

      <Field label="קטגוריה">
        <CategoryChips
          kind="finance"
          value={categoryId}
          onChange={setCategoryId}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="תיאור (רשות)" htmlFor="tx-desc">
          <Input
            id="tx-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === "income" ? "למשל: משכורת" : "למשל: סופר"}
          />
        </Field>
        {!series && (
          <Field label="תאריך" htmlFor="tx-date">
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
            <Label htmlFor="tx-recurring">חוזרת כל חודש</Label>
          </div>
          {recurring && (
            <div className="mt-3 grid gap-1.5">
              <Label htmlFor="tx-end">עד חודש (לא חובה)</Label>
              <Input
                id="tx-end"
                type="month"
                value={endMonth}
                min={date.slice(0, 7)}
                onChange={(e) => setEndMonth(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                התנועה תופיע בכל חודש מ‑{date.slice(0, 7)} באותו יום בחודש.
              </p>
            </div>
          )}
        </div>
      )}

      {!onlyThisMonth && (
        <Field label="הערות" htmlFor="tx-notes">
          <Textarea
            id="tx-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          ביטול
        </Button>
        <Button type="submit">
          {transaction || series ? "שמירה" : "הוספה"}
        </Button>
      </DialogFooter>
    </form>
  );
}
