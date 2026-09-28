import { describe, expect, it } from "vitest";
import {
  decodeBytes,
  findHeaderRow,
  guessMapping,
  markDuplicates,
  parseAmount,
  parseCsv,
  parseDate,
  rowsToDrafts,
  suggestCategory,
} from "./bank-import";
import type { Transaction } from "./types";

// Shaped like an Israeli bank account export: a title and account line
// above the table, value date beside the date, debit and credit apart,
// thousands separators, a running balance.
const STATEMENT = `תנועות בחשבון
חשבון 12-345-678901
תאריך,תאריך ערך,תיאור,אסמכתא,חובה,זכות,"יתרה בש""ח"
27/09/2026,27/09/2026,שופרסל דיל,1234,"1,250.40",,"8,000.00"
25/09/2026,26/09/2026,משכורת,5555,,"12,500.00","9,250.40"
24/09/2026,24/09/2026,"פז, תחנת דלק",77,180,,"-3,249.60"
,,יתרה לסוף תקופה,,,,"8,000.00"
`;

describe("parseCsv", () => {
  it("handles quotes, doubled quotes and commas inside fields", () => {
    const rows = parseCsv(STATEMENT);
    expect(rows[2][6]).toBe('יתרה בש"ח');
    expect(rows[5][2]).toBe("פז, תחנת דלק");
    expect(rows[3][4]).toBe("1,250.40");
  });

  it("detects semicolons and tabs", () => {
    expect(parseCsv("א;ב\n1;2")).toEqual([
      ["א", "ב"],
      ["1", "2"],
    ]);
    expect(parseCsv("א\tב\n1\t2")[1]).toEqual(["1", "2"]);
  });
});

describe("decodeBytes", () => {
  it("reads UTF-8, dropping a BOM", () => {
    const bytes = new TextEncoder().encode("﻿תאריך");
    expect(decodeBytes(bytes)).toBe("תאריך");
  });

  it("falls back to Windows-1255 for Hebrew Windows files", () => {
    // "שלום" in Windows-1255.
    const bytes = new Uint8Array([0xf9, 0xec, 0xe5, 0xed]);
    expect(decodeBytes(bytes)).toBe("שלום");
  });
});

describe("mapping", () => {
  it("finds the header row under the title lines", () => {
    expect(findHeaderRow(parseCsv(STATEMENT))).toBe(2);
  });

  it("maps date (not value date), description, debit and credit", () => {
    const rows = parseCsv(STATEMENT);
    expect(guessMapping(rows[2])).toEqual({
      date: 0,
      description: 2,
      debit: 4,
      credit: 5,
    });
  });

  it("maps a single signed amount column, never the balance", () => {
    expect(guessMapping(["תאריך", "תיאור הפעולה", "יתרה ₪", "סכום ₪"])).toEqual(
      { date: 0, description: 1, amount: 3 },
    );
  });

  it("gives up without a date or a description", () => {
    expect(guessMapping(["סכום", "תיאור"])).toBeNull();
  });
});

describe("values", () => {
  it("parses Israeli and ISO dates, and rejects impossible ones", () => {
    expect(parseDate("27/09/2026")).toBe("2026-09-27");
    expect(parseDate("7.9.26")).toBe("2026-09-07");
    expect(parseDate("2026-09-27")).toBe("2026-09-27");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("יתרה")).toBeNull();
  });

  it("parses amounts with separators, shekel signs and every minus style", () => {
    expect(parseAmount("1,250.40")).toBe(1250.4);
    expect(parseAmount("₪ 99")).toBe(99);
    expect(parseAmount("-45")).toBe(-45);
    expect(parseAmount("45-")).toBe(-45);
    expect(parseAmount("(45)")).toBe(-45);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("rowsToDrafts", () => {
  it("turns statement lines into expenses and income, skipping totals", () => {
    const rows = parseCsv(STATEMENT);
    const header = findHeaderRow(rows);
    const drafts = rowsToDrafts(
      rows.slice(header + 1),
      guessMapping(rows[header])!,
    );
    expect(drafts).toEqual([
      {
        date: "2026-09-27",
        description: "שופרסל דיל",
        amount: 1250.4,
        type: "expense",
      },
      {
        date: "2026-09-25",
        description: "משכורת",
        amount: 12500,
        type: "income",
      },
      {
        date: "2026-09-24",
        description: "פז, תחנת דלק",
        amount: 180,
        type: "expense",
      },
    ]);
  });

  it("reads the sign of a single amount column", () => {
    const drafts = rowsToDrafts(
      [
        ["01/09/2026", "החזר", "200"],
        ["02/09/2026", "סופר", "-80"],
        ["03/09/2026", "אפס", "0"],
      ],
      { date: 0, description: 1, amount: 2 },
    );
    expect(drafts.map((d) => [d.type, d.amount])).toEqual([
      ["income", 200],
      ["expense", 80],
    ]);
  });
});

const tx = (fields: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  type: "expense",
  amount: 0,
  description: "",
  date: "2026-09-01",
  createdAt: "",
  ...fields,
});

describe("markDuplicates", () => {
  it("counts: one stored coffee makes only one of two new coffees a duplicate", () => {
    const coffee = {
      date: "2026-09-10",
      description: "קפה ג'ו",
      amount: 14,
      type: "expense" as const,
    };
    const result = markDuplicates(
      [coffee, coffee, { ...coffee, amount: 15 }],
      [tx({ ...coffee, description: "קפה  ג׳ו" })],
    );
    expect(result).toEqual([true, false, false]);
  });

  it("ignores recurring series", () => {
    const rent = {
      date: "2026-09-01",
      description: "שכירות",
      amount: 5000,
      type: "expense" as const,
    };
    expect(
      markDuplicates(
        [rent],
        [tx({ ...rent, recurring: { startMonth: "2026-01" } })],
      ),
    ).toEqual([false]);
  });
});

describe("suggestCategory", () => {
  const history = [
    tx({ description: "שופרסל דיל 123", categoryId: "food" }),
    tx({ description: "שופרסל דיל 456", categoryId: "food" }),
    tx({ description: "שופרסל דיל", categoryId: "home" }),
    tx({ description: "פז", categoryId: "car" }),
    tx({ description: "משכורת", categoryId: "salary", type: "income" }),
  ];

  it("prefers the most frequent exact match, ignoring numbers", () => {
    expect(suggestCategory("שופרסל דיל 789", history)).toBe("food");
  });

  it("falls back to a past description contained in the new one", () => {
    expect(suggestCategory("פז תחנת דלק רמת גן", history)).toBeUndefined(); // "פז" is too short
    expect(
      suggestCategory("סונול תחנת דלק", [
        ...history,
        tx({ description: "סונול", categoryId: "car" }),
      ]),
    ).toBe("car");
  });

  it("only learns from the same type when asked", () => {
    expect(suggestCategory("משכורת", history, "expense")).toBeUndefined();
    expect(suggestCategory("משכורת", history, "income")).toBe("salary");
  });
});
