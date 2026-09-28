"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { Sparkles, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/store";
import { formatDate, todayKey } from "@/lib/format";
import type { Proposal, ProposalKind } from "@/lib/nl-parse";

interface SmartAddState {
  text: string | null;
  open: (text?: string) => void;
  close: () => void;
}

/** "Add in one sentence", from the palette or the "+" menu. */
export const useSmartAdd = create<SmartAddState>()((set) => ({
  text: null,
  open: (text = "") => set({ text }),
  close: () => set({ text: null }),
}));

const KIND_LABELS: Record<ProposalKind, string> = {
  task: "משימה",
  event: "אירוע",
  transaction: "תנועה",
};

type Row = Proposal & { include: boolean };

async function fetchProposals(text: string) {
  const response = await fetch("/api/assist/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, today: todayKey() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "הפענוח נכשל");
  return data as { source: "claude" | "local"; proposals: Proposal[] };
}

// A transaction needs an amount; everything needs a title.
const ready = (r: Row) =>
  r.include &&
  !!r.title.trim() &&
  (r.kind !== "transaction" || (r.amount ?? 0) > 0);

export function SmartAdd() {
  const text = useSmartAdd((s) => s.text);
  const close = useSmartAdd((s) => s.close);
  return (
    <Dialog open={text !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl">
        {text !== null && <SmartAddForm initial={text} onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}

function SmartAddForm({
  initial,
  onDone,
}: {
  initial: string;
  onDone: () => void;
}) {
  const addTask = useAppStore((s) => s.addTask);
  const addEvent = useAppStore((s) => s.addEvent);
  const addTransaction = useAppStore((s) => s.addTransaction);

  const [text, setText] = useState(initial);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [source, setSource] = useState<"claude" | "local" | null>(null);
  // Opened from the palette with a sentence: it is read straight away.
  const [busy, setBusy] = useState(!!initial.trim());
  const [error, setError] = useState<string | null>(null);

  const apply = (data: {
    source: "claude" | "local";
    proposals: Proposal[];
  }) => {
    setSource(data.source);
    setRows(data.proposals.map((p) => ({ ...p, include: true })));
  };
  const failure = (e: unknown) =>
    setError(e instanceof Error ? e.message : "הפענוח נכשל");

  async function read(value = text) {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      apply(await fetchProposals(value));
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!initial.trim()) return;
    let alive = true;
    fetchProposals(initial)
      .then((data) => alive && apply(data))
      .catch((e) => alive && failure(e))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [initial]);

  const update = (index: number, patch: Partial<Row>) =>
    setRows(
      (current) =>
        current?.map((r, i) => (i === index ? { ...r, ...patch } : r)) ?? null,
    );

  function save() {
    const picked = (rows ?? []).filter(ready);
    for (const r of picked) {
      const title = r.title.trim();
      if (r.kind === "task") {
        addTask({
          title,
          dueDate: r.date,
          dueTime: r.date ? r.time : undefined,
          priority: "normal",
        });
      } else if (r.kind === "event") {
        addEvent({
          title,
          date: r.date ?? todayKey(),
          allDay: !r.time,
          startTime: r.time,
          endTime: r.time ? r.endTime : undefined,
          color: "teal",
        });
      } else {
        addTransaction({
          type: r.type ?? "expense",
          amount: r.amount ?? 0,
          description: title,
          date: r.date ?? todayKey(),
        });
      }
    }
    toast.success(
      picked.length === 1 ? "נוסף פריט אחד" : `נוספו ${picked.length} פריטים`,
    );
    onDone();
  }

  const count = rows?.filter(ready).length ?? 0;

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          הוספה במשפט
        </DialogTitle>
        <DialogDescription>
          כותבים כמו שמדברים — ״ביום שני חממה ואחרי זה ארוחת צהריים״. לפני שנשמר
          משהו, רואים מה הובן ואפשר לתקן.
        </DialogDescription>
      </DialogHeader>

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void read();
        }}
      >
        <Textarea
          aria-label="מה להוסיף"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void read();
            }
          }}
          autoFocus
        />
        <Button
          type="submit"
          variant="outline"
          className="justify-self-start"
          disabled={busy || !text.trim()}
        >
          {busy ? "קורא…" : rows ? "קריאה מחדש" : "מה הבנת?"}
        </Button>
      </form>

      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="size-4" />
          {error}
        </p>
      )}

      {rows && (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground" role="status">
            {rows.length === 0
              ? "לא הצלחתי למצוא כאן משהו להוסיף."
              : source === "claude"
                ? `Claude הבין ${rows.length} פריטים`
                : `הובנו ${rows.length} פריטים (קריאה מקומית — עם מפתח Claude היא חכמה יותר)`}
          </p>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_7rem_1fr] sm:items-center"
            >
              <Checkbox
                checked={r.include}
                onCheckedChange={(v) => update(i, { include: !!v })}
                aria-label={`להוסיף את ${r.title}`}
              />
              <select
                aria-label="סוג"
                value={r.kind}
                onChange={(e) =>
                  update(i, { kind: e.target.value as ProposalKind })
                }
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                aria-label="כותרת"
                value={r.title}
                onChange={(e) => update(i, { title: e.target.value })}
                className="h-8"
              />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-3 sm:ps-7">
                <Input
                  type="date"
                  aria-label="תאריך"
                  value={r.date ?? ""}
                  onChange={(e) =>
                    update(i, { date: e.target.value || undefined })
                  }
                  className="h-8 w-40"
                />
                {r.kind !== "transaction" ? (
                  <Input
                    type="time"
                    aria-label="שעה"
                    value={r.time ?? ""}
                    onChange={(e) =>
                      update(i, { time: e.target.value || undefined })
                    }
                    className="h-8 w-28"
                  />
                ) : (
                  <>
                    <Input
                      type="number"
                      inputMode="decimal"
                      aria-label="סכום"
                      value={r.amount ?? ""}
                      onChange={(e) =>
                        update(i, {
                          amount: Number(e.target.value) || undefined,
                        })
                      }
                      className="h-8 w-28"
                    />
                    <select
                      aria-label="הוצאה או הכנסה"
                      value={r.type ?? "expense"}
                      onChange={(e) =>
                        update(i, {
                          type: e.target.value as "income" | "expense",
                        })
                      }
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="expense">הוצאה</option>
                      <option value="income">הכנסה</option>
                    </select>
                  </>
                )}
                <span className="text-xs text-muted-foreground">
                  {r.date ? formatDate(r.date) : "בלי תאריך"}
                  {r.time
                    ? ` · ${r.time}${r.endTime ? `–${r.endTime}` : ""}`
                    : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          ביטול
        </Button>
        <Button type="button" disabled={count === 0} onClick={save}>
          הוספה{count > 0 ? ` (${count})` : ""}
        </Button>
      </DialogFooter>
    </div>
  );
}
