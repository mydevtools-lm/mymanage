import { describe, expect, it } from "vitest";
import { matchScore, normalize, searchAll, type Searchable } from "./search";

const data: Searchable = {
  tasks: [
    {
      id: "t1",
      title: "להחליף סיסמה בבנק מרכנתיל",
      priority: "high",
      completed: false,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "t2",
      title: "מעבר דירה",
      dueDate: "2026-10-01",
      priority: "normal",
      completed: false,
      subtasks: [{ id: "s", text: "להזמין מובילים", done: false }],
      createdAt: "",
      updatedAt: "",
    },
  ],
  events: [
    {
      id: "e1",
      title: "חממה",
      date: "2026-09-28",
      allDay: true,
      color: "mint",
      createdAt: "",
    },
    {
      id: "e2",
      title: "ארוחת צהריים משפחתית",
      date: "2026-09-28",
      allDay: true,
      color: "amber",
      location: "בית סבתא",
      createdAt: "",
    },
  ],
  transactions: [
    {
      id: "x1",
      type: "expense",
      amount: 4500,
      description: "שכירות",
      date: "2026-09-01",
      createdAt: "",
    },
  ],
  notes: [
    {
      id: "n1",
      title: "רעיונות",
      body: "לבנות אפליקציה לגינה",
      createdAt: "",
      updatedAt: "",
    },
  ],
  checklists: [
    {
      id: "l1",
      title: "קניות לשבוע",
      items: [
        { id: "i1", text: "שמן בישול", done: false },
        { id: "i2", text: "אקונומיקה", done: false },
      ],
      createdAt: "",
      updatedAt: "",
    },
  ],
};

const ids = (query: string) =>
  searchAll(query, data, "2026-09-28").map((r) => r.id);

describe("normalize and matchScore", () => {
  it("ignores niqqud, geresh and punctuation", () => {
    expect(normalize("שָׁלוֹם, עוֹלָם!")).toBe("שלום עולם");
    expect(matchScore("ג'ו", "קפה ג׳ו")).toBeGreaterThan(0);
  });

  it("needs every word, and ranks a prefix above a middle match", () => {
    expect(matchScore("בנק סיסמה", "להחליף סיסמה בבנק")).toBeGreaterThan(0);
    expect(matchScore("בנק דואר", "להחליף סיסמה בבנק")).toBe(0);
    expect(matchScore("חממה", "חממה")).toBeGreaterThan(
      matchScore("חממה", "ביקור בחממה"),
    );
  });
});

describe("searchAll", () => {
  it("finds across kinds", () => {
    expect(ids("מרכנתיל")).toEqual(["t1"]);
    expect(ids("חממה")).toEqual(["e1"]);
    expect(ids("שכירות")).toEqual(["x1"]);
    expect(ids("רעיונות")).toEqual(["n1"]);
  });

  it("finds a list by an item in it, and says which", () => {
    const [hit] = searchAll("אקונומיקה", data, "2026-09-28");
    expect(hit).toMatchObject({
      kind: "list",
      id: "l1",
      detail: "ברשימה: אקונומיקה",
    });
  });

  it("finds by secondary text: subtasks, location, note body", () => {
    expect(ids("מובילים")).toEqual(["t2"]);
    expect(ids("סבתא")).toEqual(["e2"]);
    expect(ids("גינה")).toEqual(["n1"]);
  });

  it("finds an amount by its digits", () => {
    expect(ids("450")).toEqual(["x1"]);
  });

  it("returns nothing for an empty query", () => {
    expect(ids("  ")).toEqual([]);
  });
});
