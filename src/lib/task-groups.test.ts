import { describe, expect, it } from "vitest";
import {
  dayTargets,
  groupDropDate,
  groupTasksByWhen,
  whenOf,
} from "./task-groups";
import type { Task } from "./types";

const TODAY = "2026-09-28"; // a Monday
const stamp = "2026-09-20T00:00:00.000Z";

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    priority: "normal",
    completed: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...extra,
  };
}

describe("whenOf", () => {
  it.each([
    ["2026-09-27", "overdue"],
    ["2026-09-28", "today"],
    ["2026-09-29", "tomorrow"],
    ["2026-09-30", "week"],
    ["2026-10-05", "week"], // day 7 is still "this week"
    ["2026-10-06", "later"],
  ])("%s → %s", (dueDate, expected) => {
    expect(whenOf(task("t", { dueDate }), TODAY)).toBe(expected);
  });

  it("puts tasks without a date in their own bucket", () => {
    expect(whenOf(task("t"), TODAY)).toBe("undated");
  });

  it("counts seven days, not the calendar week, on a Friday", () => {
    // Friday 2 Oct: the calendar week has one day left; the next 7 days don't.
    expect(whenOf(task("t", { dueDate: "2026-10-07" }), "2026-10-02")).toBe(
      "week",
    );
  });
});

describe("groupTasksByWhen", () => {
  it("orders buckets from most to least urgent and drops empty ones", () => {
    const groups = groupTasksByWhen(
      [
        task("later", { dueDate: "2026-12-01" }),
        task("none"),
        task("late", { dueDate: "2026-09-01" }),
        task("now", { dueDate: TODAY }),
      ],
      TODAY,
    );
    expect(groups.map((g) => g.label)).toEqual([
      "באיחור",
      "היום",
      "בהמשך",
      "בלי תאריך",
    ]);
  });

  it("sorts inside a bucket by date, then time, then priority", () => {
    const [week] = groupTasksByWhen(
      [
        task("fri-low", { dueDate: "2026-10-02", priority: "low" }),
        task("wed-untimed", { dueDate: "2026-09-30" }),
        task("fri-urgent", { dueDate: "2026-10-02", priority: "urgent" }),
        task("wed-0900", { dueDate: "2026-09-30", dueTime: "09:00" }),
        task("wed-0800", { dueDate: "2026-09-30", dueTime: "08:00" }),
      ],
      TODAY,
    );
    expect(week.tasks.map((t) => t.id)).toEqual([
      "wed-0800",
      "wed-0900",
      "wed-untimed",
      "fri-urgent",
      "fri-low",
    ]);
  });
});

describe("dayTargets", () => {
  it("offers today, tomorrow, the next five days by weekday, and no date", () => {
    const targets = dayTargets(TODAY);
    expect(targets.map((t) => t.date)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      undefined,
    ]);
    expect(targets[0].label).toBe("היום");
    expect(targets[1].label).toBe("מחר");
    // Wednesday 30.9 — weekday and day.month.
    expect(targets[2].label).toMatch(/30\.9/);
    expect(targets.at(-1)?.label).toBe("בלי תאריך");
  });
});

describe("groupDropDate", () => {
  it("is a single day for today, tomorrow and no date, and nothing for spans", () => {
    expect(groupDropDate("today", TODAY)).toEqual({ date: TODAY });
    expect(groupDropDate("tomorrow", TODAY)).toEqual({ date: "2026-09-29" });
    expect(groupDropDate("undated", TODAY)).toEqual({ date: undefined });
    expect(groupDropDate("week", TODAY)).toBeNull();
    expect(groupDropDate("overdue", TODAY)).toBeNull();
  });
});
