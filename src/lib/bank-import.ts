import type { Transaction, TransactionType } from "./types";

/**
 * Bank statement import: text → rows → transactions to add.
 *
 * Built around the export of an Israeli bank account (Mercantile first):
 * Hebrew headers, dd/mm/yyyy dates, separate debit and credit columns or one
 * signed amount, thousands separators, and Windows-1255 files. Everything
 * here is pure; the screen only picks the file and shows the preview.
 */

/* ------------------------------------------------------------- decoding */

/** UTF-8 when the bytes are valid UTF-8, otherwise Windows-1255 (Hebrew
 *  Windows), which older bank exports still use. */
export function decodeBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(view)
      .replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1255").decode(view);
  }
}

/* ------------------------------------------------------------------ CSV */

function detectDelimiter(firstLine: string) {
  const counts = [",", ";", "\t"].map((d) => ({
    d,
    n: firstLine.split(d).length,
  }));
  return counts.sort((a, b) => b.n - a.n)[0].d;
}

/** RFC 4180-ish: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const delimiter = detectDelimiter(clean.split("\n", 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((cell) => cell.trim()))
    .filter((r) => r.some((cell) => cell !== ""));
}

/* -------------------------------------------------------------- mapping */

export interface ColumnMapping {
  date: number;
  description: number;
  /** One signed column… */
  amount?: number;
  /** …or two: money out and money in. */
  debit?: number;
  credit?: number;
}

const HINTS = {
  date: ["תאריך", "date"],
  // "תאריך ערך" is when the money moves; the plain date is when it happened.
  valueDate: ["תאריך ערך", "value date"],
  description: ["תיאור", "הפעולה", "פעולה", "פרטים", "description", "תאור"],
  debit: ["חובה", "חיוב", "debit", "הוצאה"],
  credit: ["זכות", "זיכוי", "credit", "הכנסה"],
  amount: ["סכום", "amount", "₪"],
};

function find(headers: string[], words: string[], skip: string[] = []) {
  const lower = headers.map((h) => h.toLowerCase());
  return lower.findIndex(
    (h) => words.some((w) => h.includes(w)) && !skip.some((s) => h.includes(s)),
  );
}

/**
 * The header row is the first row that looks like one — bank files often
 * open with a title and the account number above the table.
 */
export function findHeaderRow(rows: string[][]) {
  const index = rows.findIndex(
    (r) =>
      find(r, HINTS.date) >= 0 &&
      (find(r, HINTS.amount) >= 0 ||
        find(r, HINTS.debit) >= 0 ||
        find(r, HINTS.credit) >= 0),
  );
  return Math.max(0, index);
}

export function guessMapping(headers: string[]): ColumnMapping | null {
  let date = find(headers, HINTS.date, HINTS.valueDate);
  if (date < 0) date = find(headers, HINTS.date);
  const description = find(headers, HINTS.description, ["תאריך", "date"]);
  const debit = find(headers, HINTS.debit);
  const credit = find(headers, HINTS.credit);
  // "יתרה" (balance) often holds "₪" too; it is never the amount.
  const amount = find(headers, HINTS.amount, ["יתרה", "balance"]);
  if (date < 0 || description < 0) return null;
  if (debit >= 0 || credit >= 0) {
    return {
      date,
      description,
      debit: debit >= 0 ? debit : undefined,
      credit: credit >= 0 ? credit : undefined,
    };
  }
  if (amount >= 0) return { date, description, amount };
  return null;
}

/* --------------------------------------------------------------- values */

/** dd/mm/yyyy, dd/mm/yy, dd.mm.yyyy, dd-mm-yyyy or yyyy-mm-dd → yyyy-mm-dd. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) {
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return build(year, Number(m[2]), Number(m[1]));
  }
  return null;
}

function build(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1) return null; // 31/02 and friends
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "1,234.50", "₪ 99", "-45", "45-", "(45)" → signed number, or null. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[₪\s‎‏,]/g, "").replace(/ש"ח|nis/gi, "");
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    sign = -sign;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    sign = -sign;
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return sign * Number(s);
}

/* ---------------------------------------------------------------- rows */

export interface Draft {
  date: string;
  description: string;
  amount: number; // always positive
  type: TransactionType;
}

/** Rows that aren't a dated movement (totals, balance lines) are skipped. */
export function rowsToDrafts(rows: string[][], mapping: ColumnMapping) {
  const drafts: Draft[] = [];
  for (const row of rows) {
    const date = parseDate(row[mapping.date] ?? "");
    const description = (row[mapping.description] ?? "").trim();
    if (!date || !description) continue;

    let signed: number | null = null;
    if (mapping.amount !== undefined) {
      signed = parseAmount(row[mapping.amount] ?? "");
    } else {
      const out =
        mapping.debit !== undefined
          ? parseAmount(row[mapping.debit] ?? "")
          : null;
      const inn =
        mapping.credit !== undefined
          ? parseAmount(row[mapping.credit] ?? "")
          : null;
      if (out) signed = -Math.abs(out);
      else if (inn) signed = Math.abs(inn);
    }
    if (!signed) continue;
    drafts.push({
      date,
      description,
      amount: Math.round(Math.abs(signed) * 100) / 100,
      type: signed < 0 ? "expense" : "income",
    });
  }
  return drafts;
}

/* ----------------------------------------------------------- duplicates */

export function normalizeDescription(text: string) {
  return text
    .toLowerCase()
    .replace(/[\d"'`׳״.,:;()\-_/\\*#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function key(t: {
  date: string;
  amount: number;
  type: TransactionType;
  description: string;
}) {
  return `${t.date}|${t.type}|${t.amount.toFixed(2)}|${normalizeDescription(t.description)}`;
}

/**
 * Which drafts are already in the books. Counted, not just matched: two
 * identical coffees on one day are two rows, and if one is already stored
 * only the other is new. Only one-off rows count — a recurring series is a
 * plan, not a movement the bank would list.
 */
export function markDuplicates(drafts: Draft[], existing: Transaction[]) {
  const stored = new Map<string, number>();
  for (const t of existing) {
    if (t.recurring) continue;
    const k = key(t);
    stored.set(k, (stored.get(k) ?? 0) + 1);
  }
  return drafts.map((d) => {
    const k = key(d);
    const left = stored.get(k) ?? 0;
    if (left > 0) {
      stored.set(k, left - 1);
      return true;
    }
    return false;
  });
}

/* ------------------------------------------------------------ category */

/**
 * The category a description most likely belongs to, learned from what was
 * chosen before: an exact match of the cleaned description first, then the
 * longest past description contained in it (or containing it). Correcting a
 * category by hand is what teaches it.
 */
export function suggestCategory(
  description: string,
  history: Pick<Transaction, "description" | "categoryId" | "type">[],
  type?: TransactionType,
): string | undefined {
  const target = normalizeDescription(description);
  if (target.length < 2) return undefined;

  const exact = new Map<string, number>();
  let best: { id: string; length: number } | undefined;
  for (const t of history) {
    if (!t.categoryId || (type && t.type !== type)) continue;
    const past = normalizeDescription(t.description);
    if (past.length < 3) continue;
    if (past === target) {
      exact.set(t.categoryId, (exact.get(t.categoryId) ?? 0) + 1);
    } else if (target.includes(past) || past.includes(target)) {
      const length = Math.min(past.length, target.length);
      if (!best || length > best.length) best = { id: t.categoryId, length };
    }
  }
  if (exact.size > 0) {
    return [...exact.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return best?.id;
}
