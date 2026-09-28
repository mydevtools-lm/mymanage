"use client";

import { useMemo, useState } from "react";
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
import { ColorDot } from "@/components/shared";
import { useAppStore } from "@/lib/store";

/** A monthly ceiling per expense category. Empty means no budget. */
export function BudgetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <BudgetForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BudgetForm({ onDone }: { onDone: () => void }) {
  // Select the stored array and filter outside: a selector that builds a
  // new array each call makes the store look changed forever (React #185).
  const allCategories = useAppStore((s) => s.categories);
  const categories = useMemo(
    () => allCategories.filter((c) => c.kind === "finance"),
    [allCategories],
  );
  const budgets = useAppStore((s) => s.settings.budgets);
  const setBudgets = useAppStore((s) => s.setBudgets);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(budgets ?? {}).map(([id, amount]) => [id, String(amount)]),
    ),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, number> = {};
    for (const [id, raw] of Object.entries(values)) {
      const amount = Number(raw);
      if (raw.trim() && (!Number.isFinite(amount) || amount < 0)) {
        toast.error("תקציב צריך להיות מספר חיובי");
        return;
      }
      if (amount > 0) next[id] = amount;
    }
    setBudgets(next);
    toast.success("התקציבים נשמרו");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>תקציב חודשי</DialogTitle>
        <DialogDescription>
          כמה מותר להוציא בחודש בכל קטגוריה. ריק = בלי תקציב. חריגה מסומנת
          באדום, ומופיעה הודעה כשהוצאה חדשה עוברת את הסכום.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        {categories.map((c) => (
          <label key={c.id} className="flex items-center gap-3">
            <ColorDot color={c.color} />
            <span className="flex-1 text-sm">{c.name}</span>
            <span className="relative w-32">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="—"
                value={values[c.id] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [c.id]: e.target.value })
                }
                className="ps-7 tabular-nums"
                aria-label={`תקציב ל${c.name}`}
              />
              <span className="pointer-events-none absolute top-1/2 start-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                ₪
              </span>
            </span>
          </label>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          ביטול
        </Button>
        <Button type="submit">שמירה</Button>
      </DialogFooter>
    </form>
  );
}
