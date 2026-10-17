"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency, formatMonth } from "@/lib/format";
import { t } from "@/lib/i18n";

const chartConfig = () =>
  ({
    income: { label: t().finance.income, color: "var(--income)" },
    expense: { label: t().finance.expenses, color: "var(--expense)" },
  }) satisfies ChartConfig;

export interface TrendPoint {
  month: string; // yyyy-MM
  income: number;
  expense: number;
}

/**
 * A trend needs at least two months with something in them. Before that the
 * chart would be axes and zeros, so say what will appear instead.
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const monthsWithData = data.filter((d) => d.income + d.expense > 0).length;
  const m = t().finance.trend;
  if (monthsWithData < 2) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
        <p className="text-sm font-medium">{m.empty}</p>
        <p className="max-w-56 text-xs text-muted-foreground">
          {monthsWithData === 0 ? m.noMonths : m.oneMonth}
        </p>
      </div>
    );
  }

  const config = chartConfig();

  return (
    <ChartContainer config={config} className="h-56 w-full aspect-auto">
      <BarChart
        data={data}
        barGap={2}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(m: string) => formatMonth(m).replace(/ \d{4}$/, "")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => formatCurrency(v)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(m) => formatMonth(String(m))}
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config].label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(Number(value))}
                  </span>
                </span>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="income"
          fill="var(--color-income)"
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
        />
        <Bar
          dataKey="expense"
          fill="var(--color-expense)"
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
        />
      </BarChart>
    </ChartContainer>
  );
}
