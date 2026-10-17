"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { getMonthTransactions, summarize } from "@/lib/finance";
import { formatCurrency, formatMonth, toMonthKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export function MonthBalanceCard() {
  const transactions = useAppStore((s) => s.transactions);
  const month = toMonthKey(new Date());
  const summary = useMemo(
    () => summarize(getMonthTransactions(transactions, month)),
    [transactions, month],
  );

  const text = t().today.month;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.balanceOf(formatMonth(month))}</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/finance" />}
          >
            {text.openMoney}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <ArrowUpRight className="size-4 text-income" /> {text.income}
          </span>
          <span className="font-medium tabular-nums text-income">
            {formatCurrency(summary.income)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <ArrowDownLeft className="size-4 text-expense" /> {text.expenses}
          </span>
          <span className="font-medium tabular-nums text-expense">
            {formatCurrency(summary.expense)}
          </span>
        </div>
        <div className="border-t pt-3">
          <div className="text-xs text-muted-foreground">{text.balance}</div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              summary.balance >= 0 ? "text-income" : "text-expense",
            )}
          >
            {formatCurrency(summary.balance)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
