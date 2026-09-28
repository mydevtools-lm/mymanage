import type { Checklist } from "./types";

/**
 * A list as plain text for pasting into WhatsApp: title, then one line per
 * item with a box that shows whether it is done. Open items come first —
 * that is what the person reading it still has to get.
 */
export function listToText(list: Checklist) {
  const open = list.items.filter((i) => !i.done);
  const done = list.items.filter((i) => i.done);
  return [
    list.title,
    ...open.map((i) => `☐ ${i.text}`),
    ...done.map((i) => `☑ ${i.text}`),
  ].join("\n");
}

/** Pinned first, then the newest list — the same order the server returns. */
export function sortLists(lists: Checklist[]) {
  return [...lists].sort(
    (a, b) =>
      Number(!!b.pinned) - Number(!!a.pinned) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

/** Does the list's title or any item mention the query? */
export function listMatches(list: Checklist, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    list.title.toLowerCase().includes(q) ||
    list.items.some((i) => i.text.toLowerCase().includes(q))
  );
}
