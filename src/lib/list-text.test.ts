import { describe, expect, it } from "vitest";
import { listMatches, listToText, sortLists } from "./list-text";
import type { Checklist } from "./types";

const list = (extra: Partial<Checklist> = {}): Checklist => ({
  id: "l",
  title: "קניות לשבוע",
  items: [
    { id: "1", text: "שמן בישול", done: false },
    { id: "2", text: "אקונומיקה", done: true },
    { id: "3", text: "חלב", done: false },
  ],
  createdAt: "2026-09-26T10:00:00.000Z",
  updatedAt: "2026-09-26T10:00:00.000Z",
  ...extra,
});

describe("listToText", () => {
  it("writes open items first, then done ones, each with its box", () => {
    expect(listToText(list())).toBe(
      "קניות לשבוע\n☐ שמן בישול\n☐ חלב\n☑ אקונומיקה",
    );
  });

  it("is just the title for an empty list", () => {
    expect(listToText(list({ items: [] }))).toBe("קניות לשבוע");
  });
});

describe("sortLists", () => {
  it("puts pinned lists first, then the newest", () => {
    const sorted = sortLists([
      list({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      list({ id: "new", createdAt: "2026-09-01T00:00:00.000Z" }),
      list({
        id: "pinned-old",
        pinned: true,
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ]);
    expect(sorted.map((l) => l.id)).toEqual(["pinned-old", "new", "old"]);
  });
});

describe("listMatches", () => {
  it("finds a list by its title or by an item", () => {
    expect(listMatches(list(), "קניות")).toBe(true);
    expect(listMatches(list(), "חלב")).toBe(true);
    expect(listMatches(list(), "ביצים")).toBe(false);
    expect(listMatches(list(), "  ")).toBe(true);
  });
});
