import { describe, expect, it } from "vitest";
import {
  categoryBreakdown,
  getMonthTransactions,
  monthRange,
  planSeriesDelete,
  planSeriesEdit,
  shiftMonth,
  summarize,
} from "./finance";
import type { Category, Transaction } from "./types";

const base = { createdAt: "2026-09-01T00:00:00.000Z" };

const salary: Transaction = {
  ...base,
  id: "salary",
  type: "income",
  amount: 12000,
  description: "משכורת",
  date: "2026-09-10",
  recurring: { startMonth: "2026-09" },
};

const rent: Transaction = {
  ...base,
  id: "rent",
  type: "expense",
  amount: 4500,
  description: "שכר דירה",
  date: "2026-09-01",
  categoryId: "home",
  recurring: { startMonth: "2026-09", endMonth: "2026-11" },
};

const coffee: Transaction = {
  ...base,
  id: "coffee",
  type: "expense",
  amount: 18,
  description: "קפה",
  date: "2026-09-22",
  categoryId: "food",
};

describe("getMonthTransactions", () => {
  it("keeps a one-off transaction in its own month only", () => {
    expect(getMonthTransactions([coffee], "2026-09")).toHaveLength(1);
    expect(getMonthTransactions([coffee], "2026-10")).toHaveLength(0);
  });

  it("projects a recurring transaction into later months on the same day", () => {
    const [row] = getMonthTransactions([salary], "2027-02");
    expect(row.date).toBe("2027-02-10");
    expect(row.projected).toBe(true);
  });

  it("marks the first month of a series as not projected", () => {
    const [row] = getMonthTransactions([salary], "2026-09");
    expect(row.projected).toBe(false);
  });

  it("does not project before the series starts", () => {
    expect(getMonthTransactions([salary], "2026-08")).toHaveLength(0);
  });

  it("treats endMonth as inclusive", () => {
    expect(getMonthTransactions([rent], "2026-11")).toHaveLength(1);
    expect(getMonthTransactions([rent], "2026-12")).toHaveLength(0);
  });

  it("clamps a day that does not exist in a short month", () => {
    const monthEnd = { ...salary, date: "2026-09-31" };
    expect(getMonthTransactions([monthEnd], "2027-02")[0].date).toBe(
      "2027-02-28",
    );
  });

  it("drops a month that was skipped", () => {
    const skipped = {
      ...salary,
      exceptions: [{ month: "2026-10", skip: true }],
    };
    expect(getMonthTransactions([skipped], "2026-10")).toHaveLength(0);
    expect(getMonthTransactions([skipped], "2026-11")).toHaveLength(1);
  });

  it("applies a one-month override and flags it", () => {
    const bonus = {
      ...salary,
      exceptions: [
        { month: "2026-12", amount: 15000, description: "משכורת + בונוס" },
      ],
    };
    const [row] = getMonthTransactions([bonus], "2026-12");
    expect(row.amount).toBe(15000);
    expect(row.description).toBe("משכורת + בונוס");
    expect(row.overridden).toBe(true);
    expect(getMonthTransactions([bonus], "2027-01")[0].amount).toBe(12000);
  });

  it("sorts newest first", () => {
    const rows = getMonthTransactions([rent, coffee, salary], "2026-09");
    expect(rows.map((r) => r.id)).toEqual(["coffee", "salary", "rent"]);
  });
});

describe("summarize and categoryBreakdown", () => {
  const categories: Category[] = [
    { id: "home", name: "בית", color: "coral", kind: "finance" },
    { id: "food", name: "אוכל", color: "amber", kind: "finance" },
  ];
  const rows = getMonthTransactions([salary, rent, coffee], "2026-09");

  it("adds income and expenses and computes the balance", () => {
    expect(summarize(rows)).toEqual({
      income: 12000,
      expense: 4518,
      balance: 7482,
    });
  });

  it("splits expenses by category, largest first, with shares", () => {
    const breakdown = categoryBreakdown(rows, categories, "expense");
    expect(breakdown.map((b) => b.category?.name)).toEqual(["בית", "אוכל"]);
    expect(breakdown[0].share).toBeCloseTo(4500 / 4518);
  });
});

describe("month helpers", () => {
  it("lists months inclusively across a year boundary", () => {
    expect(monthRange("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("shifts months in both directions", () => {
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("planSeriesDelete", () => {
  it("'this' skips only that month", () => {
    const plan = planSeriesDelete(salary, "2026-11", "this");
    expect(plan).toEqual({
      kind: "update",
      id: "salary",
      patch: { exceptions: [{ month: "2026-11", skip: true }] },
    });
  });

  it("'following' ends the series the month before", () => {
    const plan = planSeriesDelete(salary, "2026-11", "following");
    expect(plan.kind).toBe("update");
    if (plan.kind !== "update") return;
    expect(plan.patch.recurring).toEqual({
      startMonth: "2026-09",
      endMonth: "2026-10",
    });
  });

  it("'following' from the first month deletes the whole series", () => {
    expect(planSeriesDelete(salary, "2026-09", "following")).toEqual({
      kind: "delete",
      id: "salary",
    });
  });

  it("'following' drops exceptions that no longer have a month to apply to", () => {
    const withExceptions = {
      ...salary,
      exceptions: [
        { month: "2026-10", skip: true },
        { month: "2026-12", amount: 1 },
      ],
    };
    const plan = planSeriesDelete(withExceptions, "2026-11", "following");
    if (plan.kind !== "update") throw new Error("expected update");
    expect(plan.patch.exceptions).toEqual([{ month: "2026-10", skip: true }]);
  });

  it("'all' deletes, and so does anything on a one-off", () => {
    expect(planSeriesDelete(salary, "2026-11", "all").kind).toBe("delete");
    expect(planSeriesDelete(coffee, "2026-09", "this").kind).toBe("delete");
  });

  // The bug this replaces: deleting from a projected month used to delete the
  // original row and with it every month of the series.
  it("never deletes the series for a single-month delete", () => {
    expect(planSeriesDelete(rent, "2026-10", "this").kind).not.toBe("delete");
  });
});

describe("planSeriesEdit", () => {
  it("'this' stores an override for that month only", () => {
    const plan = planSeriesEdit(salary, "2026-12", "this", { amount: 15000 });
    expect(plan).toEqual({
      kind: "update",
      id: "salary",
      patch: { exceptions: [{ month: "2026-12", amount: 15000 }] },
    });
  });

  it("'this' twice on the same month merges into one exception", () => {
    const once = planSeriesEdit(salary, "2026-12", "this", { amount: 15000 });
    if (once.kind !== "update") throw new Error("expected update");
    const twice = planSeriesEdit(
      { ...salary, ...once.patch },
      "2026-12",
      "this",
      { description: "בונוס" },
    );
    if (twice.kind !== "update") throw new Error("expected update");
    expect(twice.patch.exceptions).toEqual([
      { month: "2026-12", amount: 15000, description: "בונוס" },
    ]);
  });

  it("'following' splits into an ended series and a new one", () => {
    const withExceptions = {
      ...rent,
      exceptions: [
        { month: "2026-09", amount: 4000 },
        { month: "2026-11", skip: true },
      ],
    };
    const plan = planSeriesEdit(withExceptions, "2026-10", "following", {
      amount: 4800,
    });
    expect(plan.kind).toBe("split");
    if (plan.kind !== "split") return;

    expect(plan.patch.recurring).toEqual({
      startMonth: "2026-09",
      endMonth: "2026-09",
    });
    expect(plan.patch.exceptions).toEqual([{ month: "2026-09", amount: 4000 }]);

    expect(plan.create.amount).toBe(4800);
    expect(plan.create.date).toBe("2026-10-01");
    expect(plan.create.recurring).toEqual({
      startMonth: "2026-10",
      endMonth: "2026-11",
    });
    expect(plan.create.exceptions).toEqual([{ month: "2026-11", skip: true }]);
  });

  it("'following' from the first month edits the series in place", () => {
    expect(planSeriesEdit(rent, "2026-09", "following", { amount: 1 })).toEqual(
      { kind: "update", id: "rent", patch: { amount: 1 } },
    );
  });

  it("'all' updates the series directly", () => {
    expect(planSeriesEdit(rent, "2026-10", "all", { amount: 1 })).toEqual({
      kind: "update",
      id: "rent",
      patch: { amount: 1 },
    });
  });
});
