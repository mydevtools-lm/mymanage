"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
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
import { CategorySelect, Field, NONE } from "@/components/fields";
import { useAppStore } from "@/lib/store";
import { todayKey } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultDate?: string;
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
}: TransactionDialogProps) {
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);

  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? "expense",
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : "",
  );
  const [description, setDescription] = useState(
    transaction?.description ?? "",
  );
  const [date, setDate] = useState(
    transaction?.date ?? defaultDate ?? todayKey(),
  );
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? NONE);
  const [notes, setNotes] = useState(transaction?.notes ?? "");
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
    if (!description.trim()) {
      toast.error("צריך תיאור");
      return;
    }
    if (!date) {
      toast.error("צריך תאריך");
      return;
    }
    const input = {
      type,
      amount: value,
      description: description.trim(),
      date,
      categoryId: categoryId === NONE ? undefined : categoryId,
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

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{transaction ? "עריכת תנועה" : "תנועה חדשה"}</DialogTitle>
      </DialogHeader>

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

      <div className="grid grid-cols-2 gap-3">
        <Field label="סכום (₪)" htmlFor="tx-amount">
          <Input
            id="tx-amount"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={cn(
              "text-lg font-semibold tabular-nums",
              type === "income" ? "text-income" : "text-expense",
            )}
            autoFocus
          />
        </Field>
        <Field label="תאריך" htmlFor="tx-date">
          <Input
            id="tx-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="תיאור" htmlFor="tx-desc">
        <Input
          id="tx-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === "income" ? "למשל: משכורת" : "למשל: סופר"}
        />
      </Field>

      <Field label="קטגוריה">
        <CategorySelect
          kind="finance"
          value={categoryId}
          onChange={setCategoryId}
        />
      </Field>

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

      <Field label="הערות" htmlFor="tx-notes">
        <Textarea
          id="tx-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          ביטול
        </Button>
        <Button type="submit">{transaction ? "שמירה" : "הוספה"}</Button>
      </DialogFooter>
    </form>
  );
}
