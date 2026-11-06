"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/fields";
import { useAppStore } from "@/lib/store";
import { debtPaid, debtRemaining } from "@/lib/finance";
import { formatCurrency, formatDate, todayKey } from "@/lib/format";
import type { Debt, DebtDirection } from "@/lib/types";
import { t } from "@/lib/i18n";

interface DebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt | null;
}

// The form lives in its own component so its state resets every time the
// dialog content mounts (base-ui unmounts the popup when closed).
export function DebtDialog(props: DebtDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DebtForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function DebtForm({ onOpenChange, debt }: DebtDialogProps) {
  const addDebt = useAppStore((s) => s.addDebt);
  const updateDebt = useAppStore((s) => s.updateDebt);
  const deletePayment = useAppStore((s) => s.deleteDebtPayment);
  // The list follows the store, so a deleted payment leaves it at once.
  const payments = useAppStore(
    (s) => s.debts.find((d) => d.id === debt?.id)?.payments,
  );

  const [direction, setDirection] = useState<DebtDirection>(
    debt?.direction ?? "owe",
  );
  const [person, setPerson] = useState(debt?.person ?? "");
  const [amount, setAmount] = useState(debt ? String(debt.amount) : "");
  const [description, setDescription] = useState(debt?.description ?? "");
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? "");
  const [notes, setNotes] = useState(debt?.notes ?? "");

  const m = t().finance.debts;
  const common = t().common;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!person.trim()) {
      toast.error(m.needPerson);
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(m.needAmount);
      return;
    }
    if (value < debtPaid({ payments: payments ?? [] })) {
      toast.error(m.belowPaid);
      return;
    }
    if (debt) {
      updateDebt(debt.id, {
        direction,
        person: person.trim(),
        amount: value,
        description: description.trim() || null,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
      });
      toast.success(m.updated);
    } else {
      addDebt({
        direction,
        person: person.trim(),
        amount: value,
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(m.added);
    }
    onOpenChange(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{debt ? m.edit : m.new}</DialogTitle>
      </DialogHeader>

      <Tabs
        value={direction}
        onValueChange={(v) => setDirection(v as DebtDirection)}
        aria-label={m.direction}
      >
        <TabsList className="w-full">
          <TabsTrigger value="owe" className="data-active:text-expense">
            {m.iOwe}
          </TabsTrigger>
          <TabsTrigger value="owed" className="data-active:text-income">
            {m.owedToMe}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Field label={m.person} htmlFor="debt-person">
        <Input
          id="debt-person"
          value={person}
          placeholder={m.personPlaceholder}
          onChange={(e) => setPerson(e.target.value)}
          autoFocus
        />
      </Field>

      <Field label={m.amount} htmlFor="debt-amount">
        <Input
          id="debt-amount"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tabular-nums"
        />
      </Field>

      <Field label={m.description} htmlFor="debt-description">
        <Input
          id="debt-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label={m.dueDate} htmlFor="debt-due">
        <Input
          id="debt-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </Field>

      <Field label={m.notes} htmlFor="debt-notes">
        <Textarea
          id="debt-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {debt && (
        <div className="grid gap-1.5">
          <div className="text-sm font-medium">{m.payments}</div>
          {!payments?.length ? (
            <p className="text-sm text-muted-foreground">{m.noPayments}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm"
                >
                  <span className="text-muted-foreground">
                    {formatDate(p.date)}
                  </span>
                  <span className="ms-auto font-medium tabular-nums">
                    {formatCurrency(p.amount)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={m.deletePayment}
                    title={m.deletePayment}
                    onClick={() => deletePayment(debt.id, p.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          {common.cancel}
        </Button>
        <Button type="submit">{debt ? common.save : common.add}</Button>
      </DialogFooter>
    </form>
  );
}

/** One payment on a debt. Nothing here touches income or expenses. */
export function DebtPaymentDialog({
  debt,
  open,
  onOpenChange,
}: {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {debt && <PaymentForm debt={debt} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  debt,
  onOpenChange,
}: {
  debt: Debt;
  onOpenChange: (open: boolean) => void;
}) {
  const addPayment = useAppStore((s) => s.addDebtPayment);
  const remaining = debtRemaining(debt);
  const [amount, setAmount] = useState(String(remaining));
  const [date, setDate] = useState(todayKey);

  const m = t().finance.debts;
  const common = t().common;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(m.needAmount);
      return;
    }
    if (value > remaining) {
      toast.error(m.overpaid);
      return;
    }
    addPayment(debt.id, { amount: value, date });
    toast.success(m.payAdded);
    onOpenChange(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{m.payTitle(debt.person)}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        {m.payLeft(formatCurrency(remaining))}
      </p>
      <Field label={m.amount} htmlFor="payment-amount">
        <Input
          id="payment-amount"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tabular-nums"
          autoFocus
        />
      </Field>
      <Field label={m.payDate} htmlFor="payment-date">
        <Input
          id="payment-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          {common.cancel}
        </Button>
        <Button type="submit">{m.pay}</Button>
      </DialogFooter>
    </form>
  );
}
