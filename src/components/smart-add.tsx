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
import { isTauri } from "@/lib/platform";
import { getLocale, t } from "@/lib/i18n";
import { desktopParse } from "@/lib/desktop-services";

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

type Row = Proposal & { include: boolean };

async function fetchProposals(text: string) {
  // The desktop app keeps the Claude key in Rust; same answer, no server.
  if (isTauri()) return desktopParse(text, todayKey());
  const response = await fetch("/api/assist/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-locale": getLocale() },
    body: JSON.stringify({ text, today: todayKey() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? t().assist.failed);
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
    setError(e instanceof Error ? e.message : t().assist.failed);

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
    toast.success(t().assist.added(picked.length));
    onDone();
  }

  const count = rows?.filter(ready).length ?? 0;
  const m = t().assist;

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          {m.title}
        </DialogTitle>
        <DialogDescription>{m.description}</DialogDescription>
      </DialogHeader>

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void read();
        }}
      >
        <Textarea
          aria-label={m.input}
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
          {busy ? m.reading : rows ? m.readAgain : m.read}
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
              ? m.nothingFound
              : source === "claude"
                ? m.claudeFound(rows.length)
                : m.localFound(rows.length)}
          </p>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_7rem_1fr] sm:items-center"
            >
              <Checkbox
                checked={r.include}
                onCheckedChange={(v) => update(i, { include: !!v })}
                aria-label={m.include(r.title)}
              />
              <select
                aria-label={m.kind}
                value={r.kind}
                onChange={(e) =>
                  update(i, { kind: e.target.value as ProposalKind })
                }
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                {Object.entries(m.kinds).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                aria-label={m.itemTitle}
                value={r.title}
                onChange={(e) => update(i, { title: e.target.value })}
                className="h-8"
              />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-3 sm:ps-7">
                <Input
                  type="date"
                  aria-label={m.date}
                  value={r.date ?? ""}
                  onChange={(e) =>
                    update(i, { date: e.target.value || undefined })
                  }
                  className="h-8 w-40"
                />
                {r.kind !== "transaction" ? (
                  <Input
                    type="time"
                    aria-label={m.time}
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
                      aria-label={m.amount}
                      value={r.amount ?? ""}
                      onChange={(e) =>
                        update(i, {
                          amount: Number(e.target.value) || undefined,
                        })
                      }
                      className="h-8 w-28"
                    />
                    <select
                      aria-label={m.direction}
                      value={r.type ?? "expense"}
                      onChange={(e) =>
                        update(i, {
                          type: e.target.value as "income" | "expense",
                        })
                      }
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="expense">{m.expense}</option>
                      <option value="income">{m.income}</option>
                    </select>
                  </>
                )}
                <span className="text-xs text-muted-foreground">
                  {r.date ? formatDate(r.date) : t().common.noDate}
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
          {t().common.cancel}
        </Button>
        <Button type="button" disabled={count === 0} onClick={save}>
          {m.addCount(count)}
        </Button>
      </DialogFooter>
    </div>
  );
}
