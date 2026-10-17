"use client";

import { useMemo, useState } from "react";
import { FileUp, TriangleAlert } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import {
  decodeBytes,
  findHeaderRow,
  guessMapping,
  markDuplicates,
  parseCsv,
  rowsToDrafts,
  suggestCategory,
  type ColumnMapping,
} from "@/lib/bank-import";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Bank "Excel" files are often an HTML table with an .xls name. */
function htmlTableRows(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("tr")]
    .map((tr) =>
      [...tr.querySelectorAll("th,td")].map((cell) =>
        (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
      ),
    )
    .filter((row) => row.some(Boolean));
}

async function readTable(file: File): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // "PK" — a real .xlsx (a zip). Excel can save it as CSV in one step.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    throw new Error(t().finance.import.xlsx);
  }
  const text = decodeBytes(bytes);
  return /^\s*</.test(text) ? htmlTableRows(text) : parseCsv(text);
}

const NO_COLUMN = -1;
const NONE_CATEGORY = "";

function ColumnSelect({
  id,
  label,
  headers,
  value,
  onChange,
  optional,
}: {
  id: string;
  label: string;
  headers: string[];
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  optional?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <select
        id={id}
        value={value ?? NO_COLUMN}
        onChange={(e) => {
          const next = Number(e.target.value);
          onChange(next === NO_COLUMN ? undefined : next);
        }}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {optional && <option value={NO_COLUMN}>—</option>}
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || t().finance.import.column(i + 1)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Bank statement → transactions: pick the file, check the columns, untick
 * what shouldn't come in, fix categories, import. Rows already in the books
 * start unticked.
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <ImportForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const transactions = useAppStore((s) => s.transactions);
  // Select the stored array and filter outside: a selector that builds a
  // new array each call makes the store look changed forever (React #185).
  const allCategories = useAppStore((s) => s.categories);
  const categories = useMemo(
    () => allCategories.filter((c) => c.kind === "finance"),
    [allCategories],
  );
  const importTransactions = useAppStore((s) => s.importTransactions);

  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [unticked, setUnticked] = useState<Set<number> | null>(null);
  const [chosen, setChosen] = useState<Record<number, string>>({});

  const headerIndex = table ? findHeaderRow(table) : 0;
  const headers = table?.[headerIndex] ?? [];

  const drafts = useMemo(
    () =>
      table && mapping
        ? rowsToDrafts(table.slice(headerIndex + 1), mapping)
        : [],
    [table, mapping, headerIndex],
  );
  const duplicates = useMemo(
    () => markDuplicates(drafts, transactions),
    [drafts, transactions],
  );
  const suggested = useMemo(
    () =>
      drafts.map(
        (d) => suggestCategory(d.description, transactions, d.type) ?? "",
      ),
    [drafts, transactions],
  );
  // Until the person touches a box, duplicates are the unticked ones.
  const skipped =
    unticked ?? new Set(duplicates.flatMap((dup, i) => (dup ? [i] : [])));
  const picked = drafts.filter((_, i) => !skipped.has(i));

  // Different columns make different rows; start the choices over.
  function remap(next: ColumnMapping) {
    setMapping(next);
    setUnticked(null);
    setChosen({});
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUnticked(null);
    setChosen({});
    setFileName(file.name);
    try {
      const rows = await readTable(file);
      const header = findHeaderRow(rows);
      const guess = guessMapping(rows[header] ?? []);
      setTable(rows);
      setMapping(guess);
      if (!guess) {
        setError(t().finance.import.noColumns);
        setMapping({ date: 0, description: 1, amount: 2 });
      }
    } catch (e) {
      setTable(null);
      setMapping(null);
      setError(e instanceof Error ? e.message : t().finance.import.readFailed);
    }
  }

  function toggle(index: number) {
    const next = new Set(skipped);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setUnticked(next);
  }

  function submit() {
    importTransactions(
      drafts.flatMap((d, i) => {
        if (skipped.has(i)) return [];
        const categoryId = (chosen[i] ?? suggested[i]) || undefined;
        return [{ ...d, categoryId }];
      }),
    );
    onDone();
  }

  const m = t().finance;
  const splitColumns = mapping?.amount === undefined;
  const duplicateCount = duplicates.filter(Boolean).length;

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{m.import.title}</DialogTitle>
        <DialogDescription>{m.import.description}</DialogDescription>
      </DialogHeader>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 transition-colors can-hover:hover:bg-accent/40">
        <FileUp className="size-5 text-muted-foreground" />
        <span className="text-sm">{fileName || m.import.pickFile}</span>
        <input
          type="file"
          accept=".csv,.txt,.xls,.html,text/csv"
          className="sr-only"
          aria-label={m.import.file}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      {error && (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {table && mapping && (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
              {m.import.columns}
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ColumnSelect
                id="map-date"
                label={m.date}
                headers={headers}
                value={mapping.date}
                onChange={(v) => remap({ ...mapping, date: v ?? 0 })}
              />
              <ColumnSelect
                id="map-desc"
                label={m.description}
                headers={headers}
                value={mapping.description}
                onChange={(v) => remap({ ...mapping, description: v ?? 0 })}
              />
              {splitColumns ? (
                <>
                  <ColumnSelect
                    id="map-debit"
                    label={m.import.debit}
                    headers={headers}
                    value={mapping.debit}
                    optional
                    onChange={(v) => remap({ ...mapping, debit: v })}
                  />
                  <ColumnSelect
                    id="map-credit"
                    label={m.import.credit}
                    headers={headers}
                    value={mapping.credit}
                    optional
                    onChange={(v) => remap({ ...mapping, credit: v })}
                  />
                </>
              ) : (
                <ColumnSelect
                  id="map-amount"
                  label={m.import.signedAmount}
                  headers={headers}
                  value={mapping.amount}
                  onChange={(v) => remap({ ...mapping, amount: v ?? 0 })}
                />
              )}
            </div>
            <button
              type="button"
              className="justify-self-start text-xs text-primary underline-offset-4 hover:underline"
              onClick={() =>
                remap(
                  splitColumns
                    ? {
                        date: mapping.date,
                        description: mapping.description,
                        amount: mapping.debit ?? mapping.credit ?? 0,
                      }
                    : {
                        date: mapping.date,
                        description: mapping.description,
                        debit: mapping.amount,
                      },
                )
              }
            >
              {splitColumns ? m.import.oneColumn : m.import.twoColumns}
            </button>
          </fieldset>

          <p className="text-sm text-muted-foreground" role="status">
            {drafts.length === 0
              ? m.import.noRows
              : m.import.found(drafts.length, duplicateCount)}
          </p>

          {drafts.length > 0 && (
            <div className="max-h-[45dvh] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 p-2">
                      <span className="sr-only">{m.import.include}</span>
                    </th>
                    <th className="p-2 text-start font-medium">{m.date}</th>
                    <th className="p-2 text-start font-medium">
                      {m.description}
                    </th>
                    <th className="p-2 text-start font-medium">{m.amount}</th>
                    <th className="p-2 text-start font-medium">{m.category}</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d, i) => {
                    const off = skipped.has(i);
                    return (
                      <tr
                        key={i}
                        className={cn(
                          "border-t",
                          off && "text-muted-foreground",
                        )}
                      >
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={!off}
                            onCheckedChange={() => toggle(i)}
                            aria-label={m.import.includeRow(d.description)}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap tabular-nums">
                          {formatDate(d.date)}
                        </td>
                        <td className="p-2">
                          <span className={cn(off && "line-through")}>
                            {d.description}
                          </span>
                          {duplicates[i] && (
                            <span className="ms-2 rounded bg-muted px-1.5 text-[11px] text-muted-foreground">
                              {m.import.exists}
                            </span>
                          )}
                        </td>
                        <td
                          className={cn(
                            "p-2 whitespace-nowrap font-medium tabular-nums",
                            d.type === "income"
                              ? "text-income"
                              : "text-expense",
                          )}
                        >
                          {d.type === "income" ? "+" : "−"}
                          {formatCurrency(d.amount)}
                        </td>
                        <td className="p-2">
                          <select
                            aria-label={m.import.categoryFor(d.description)}
                            value={chosen[i] ?? suggested[i]}
                            onChange={(e) =>
                              setChosen({ ...chosen, [i]: e.target.value })
                            }
                            className="h-7 max-w-36 rounded-md border bg-background px-1.5 text-xs"
                          >
                            <option value={NONE_CATEGORY}>
                              {t().common.none}
                            </option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t().common.cancel}
        </Button>
        <Button type="button" disabled={picked.length === 0} onClick={submit}>
          {m.import.submit(picked.length)}
        </Button>
      </DialogFooter>
    </div>
  );
}
