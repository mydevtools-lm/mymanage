"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  HandCoins,
  Pencil,
  RotateCcw,
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
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RowActions, type RowAction } from "@/components/row-actions";
import { DebtPaymentDialog } from "@/components/finance/debt-dialog";
import { useQuickAdd } from "@/components/quick-add";
import { EmptyState } from "@/components/shared";
import { useAppStore } from "@/lib/store";
import {
  debtPaid,
  debtRemaining,
  debtTotals,
  isDebtOpen,
  openDebts,
} from "@/lib/finance";
import { formatCurrency, formatDate, todayKey } from "@/lib/format";
import type { Debt } from "@/lib/types";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/**
 * Open debts: what I owe and what is owed to me, with what is left of each.
 * Kept apart from income and expenses: a payment here changes no balance.
 */
export function DebtsView() {
  const debts = useAppStore((s) => s.debts);
  const updateDebt = useAppStore((s) => s.updateDebt);
  const deleteDebt = useAppStore((s) => s.deleteDebt);
  const openNew = () => useQuickAdd.getState().open("debt");

  const [paying, setPaying] = useState<Debt | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [deleting, setDeleting] = useState<Debt | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const totals = useMemo(() => debtTotals(debts), [debts]);
  const open = useMemo(() => openDebts(debts), [debts]);
  const closed = useMemo(
    () => debts.filter((d) => !isDebtOpen(d)),
    [debts],
  );

  const m = t().finance.debts;
  const common = t().common;

  const actionsFor = (debt: Debt): RowAction[] => [
    ...(isDebtOpen(debt)
      ? [
          {
            label: m.pay,
            icon: Wallet,
            onSelect: () => {
              setPaying(debt);
              setPayOpen(true);
            },
          },
        ]
      : []),
    {
      label: common.edit,
      icon: Pencil,
      onSelect: () => useQuickAdd.getState().openEdit({ kind: "debt", debt }),
    },
    // Paid in full closes by itself and has nothing to reopen.
    ...(debtRemaining(debt) > 0
      ? [
          debt.closedAt
            ? {
                label: m.reopen,
                icon: RotateCcw,
                onSelect: () => updateDebt(debt.id, { closedAt: null }),
              }
            : {
                label: m.close,
                icon: CheckCircle2,
                onSelect: () =>
                  updateDebt(debt.id, { closedAt: new Date().toISOString() }),
              },
        ]
      : []),
    {
      label: common.delete,
      icon: Trash2,
      destructive: true,
      onSelect: () => {
        setDeleting(debt);
        setDeleteOpen(true);
      },
    },
  ];

  return (
    <>
      <div className="mb-2 grid grid-cols-2 gap-2 sm:gap-4">
        <TotalCard title={m.iOwe} value={totals.owe} direction="owe" />
        <TotalCard title={m.owedToMe} value={totals.owed} direction="owed" />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{m.apart}</p>

      <Card>
        <CardHeader>
          <CardTitle>{m.open}</CardTitle>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title={m.empty}
              hint={m.emptyHint}
              action={{ label: m.new, onClick: openNew }}
            />
          ) : (
            <div className="divide-y">
              {open.map((debt) => (
                <DebtRow key={debt.id} debt={debt} actions={actionsFor(debt)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {closed.length > 0 && (
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showClosed}
            onClick={() => setShowClosed((v) => !v)}
          >
            <ChevronDown
              className={cn("transition-transform", showClosed && "rotate-180")}
            />
            {m.closed(closed.length)}
          </Button>
          {showClosed && (
            <Card className="mt-2">
              <CardContent className="divide-y">
                {closed.map((debt) => (
                  <DebtRow
                    key={debt.id}
                    debt={debt}
                    actions={actionsFor(debt)}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <DebtPaymentDialog
        debt={paying}
        open={payOpen}
        onOpenChange={setPayOpen}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleting ? m.deleteTitle(deleting.person) : ""}
        description={m.deleteBody}
        onConfirm={() => deleting && deleteDebt(deleting.id)}
      />
    </>
  );
}

function TotalCard({
  title,
  value,
  direction,
}: {
  title: string;
  value: number;
  direction: Debt["direction"];
}) {
  const owe = direction === "owe";
  const Icon = owe ? ArrowDownLeft : ArrowUpRight;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className={cn("size-4", owe ? "text-expense" : "text-income")} />
          {title}
        </CardDescription>
        <CardTitle
          className={cn(
            "text-xl tabular-nums sm:text-2xl",
            owe ? "text-expense" : "text-income",
          )}
        >
          {formatCurrency(value)}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function DebtRow({ debt, actions }: { debt: Debt; actions: RowAction[] }) {
  const m = t().finance.debts;
  const owe = debt.direction === "owe";
  const Icon = owe ? ArrowDownLeft : ArrowUpRight;
  const open = isDebtOpen(debt);
  const remaining = debtRemaining(debt);
  const overdue = open && !!debt.dueDate && debt.dueDate < todayKey();
  const share = Math.min(100, (debtPaid(debt) / debt.amount) * 100);

  return (
    <div className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          owe ? "bg-expense/15 text-expense" : "bg-income/15 text-income",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate font-medium">{debt.person}</span>
          {debt.description && (
            <span className="truncate text-sm text-muted-foreground">
              {debt.description}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {remaining === 0
              ? m.paidInFull
              : !open
                ? m.closedByHand
                : m.left(
                    formatCurrency(remaining),
                    formatCurrency(debt.amount),
                  )}
          </span>
          {open && debt.dueDate && (
            <span className={cn(overdue && "font-medium text-expense")}>
              {overdue
                ? m.overdue(formatDate(debt.dueDate))
                : m.due(formatDate(debt.dueDate))}
            </span>
          )}
        </div>
        {open && (
          <Progress
            value={share}
            aria-label={m.paidShare(debt.person)}
            className="mt-1.5"
          />
        )}
      </div>
      <RowActions actions={actions} />
    </div>
  );
}
