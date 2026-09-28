import type {
  CalendarEvent,
  Checklist,
  Note,
  Routine,
  Task,
  Transaction,
} from "./types";

/**
 * One search over everything: tasks, routines, events, transactions, notes,
 * lists and the items in them. Pure, so the palette and the link picker share
 * it and it can be tested without a screen.
 */

export type ResultKind =
  "task" | "routine" | "event" | "transaction" | "note" | "list";

export interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  /** A second line: the date, the amount, the list an item sits in… */
  detail?: string;
  /** For sorting inside a kind: nearer to today first. */
  date?: string;
  score: number;
}

export interface Searchable {
  tasks: Task[];
  routines?: Routine[];
  events: CalendarEvent[];
  transactions: Transaction[];
  notes: Note[];
  checklists: Checklist[];
}

/** Lower case, no niqqud or geresh, no punctuation, single spaces. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[׳״'"`.,:;!?()\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How well `text` answers `query`: every word of the query must appear.
 * A title that starts with the query beats one that merely contains it.
 */
export function matchScore(query: string, text: string) {
  const q = normalize(query);
  if (!q) return 0;
  const t = normalize(text);
  const words = q.split(" ");
  if (!words.every((w) => t.includes(w))) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(" ").some((w) => w.startsWith(words[0]))) return 60;
  return 40;
}

function amountText(amount: number) {
  return `₪${amount.toLocaleString("he-IL")}`;
}

/** Digits in the query also find amounts: "450" finds ₪4,500. */
function amountMatches(query: string, amount: number) {
  const digits = query.replace(/[^\d]/g, "");
  return digits.length >= 2 && String(amount).includes(digits);
}

export function searchAll(
  query: string,
  data: Searchable,
  today: string,
  limit = 30,
): SearchResult[] {
  if (!normalize(query)) return [];
  const results: SearchResult[] = [];
  const add = (
    r: Omit<SearchResult, "score">,
    ...texts: (string | undefined)[]
  ) => {
    // The title counts in full; the other text only a little.
    const [title, ...rest] = texts;
    const score = Math.max(
      matchScore(query, title ?? ""),
      ...rest.map((t) => (t ? matchScore(query, t) / 4 : 0)),
    );
    if (score > 0) results.push({ ...r, score });
  };

  for (const t of data.tasks) {
    add(
      {
        kind: "task",
        id: t.id,
        title: t.title,
        detail: t.archivedAt ? "בארכיון" : t.dueDate,
        date: t.dueDate,
      },
      t.title,
      t.description,
      ...(t.subtasks ?? []).map((s) => s.text),
    );
  }
  for (const r of data.routines ?? []) {
    add(
      { kind: "routine", id: r.id, title: r.title, detail: "משימה קבועה" },
      r.title,
      r.description,
    );
  }
  for (const e of data.events) {
    add(
      { kind: "event", id: e.id, title: e.title, detail: e.date, date: e.date },
      e.title,
      e.location,
      e.notes,
    );
  }
  for (const t of data.transactions) {
    const base = {
      kind: "transaction" as const,
      id: t.id,
      title: t.description,
      detail: `${t.type === "income" ? "+" : "−"}${amountText(t.amount)} · ${t.date}`,
      date: t.date,
    };
    if (amountMatches(query, t.amount)) results.push({ ...base, score: 50 });
    else add(base, t.description, t.notes);
  }
  for (const n of data.notes) {
    add(
      {
        kind: "note",
        id: n.id,
        title: n.title || n.body.slice(0, 40),
        detail: "הערה",
      },
      n.title,
      n.body,
    );
  }
  for (const l of data.checklists) {
    // An item counts like a title: "חלב" should find the shopping list.
    const hit = l.items.find((i) => matchScore(query, i.text) > 0);
    const score = Math.max(
      matchScore(query, l.title),
      hit ? matchScore(query, hit.text) : 0,
    );
    if (score > 0) {
      results.push({
        kind: "list",
        id: l.id,
        title: l.title,
        detail: hit ? `ברשימה: ${hit.text}` : `${l.items.length} פריטים`,
        score,
      });
    }
  }

  const distance = (date?: string) =>
    date ? Math.abs(Date.parse(date) - Date.parse(today)) : Infinity;
  return results
    .sort((a, b) => b.score - a.score || distance(a.date) - distance(b.date))
    .slice(0, limit);
}
