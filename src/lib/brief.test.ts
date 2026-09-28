import { describe, expect, it } from "vitest";
import {
  dueReminders,
  morningBrief,
  upcomingBills,
  weekSummary,
} from "./brief";
import type { CalendarEvent, Task, Transaction } from "./types";

// Monday 28 September 2026, Israel.
const TODAY = "2026-09-28";

const task = (fields: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2),
  title: "משימה",
  priority: "normal",
  completed: false,
  createdAt: "",
  updatedAt: "",
  ...fields,
});

const event = (fields: Partial<CalendarEvent>): CalendarEvent => ({
  id: Math.random().toString(36).slice(2),
  title: "אירוע",
  date: TODAY,
  allDay: false,
  color: "teal",
  createdAt: "",
  ...fields,
});

const tx = (fields: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  type: "expense",
  amount: 100,
  description: "x",
  date: TODAY,
  createdAt: "",
  ...fields,
});

describe("upcomingBills", () => {
  it("finds recurring expenses due within three days, across a month end", () => {
    const bills = upcomingBills(
      [
        tx({
          id: "rent",
          description: "שכירות",
          amount: 5000,
          date: "2026-01-01",
          recurring: { startMonth: "2026-01" },
        }),
        tx({
          id: "phone",
          description: "טלפון",
          date: "2026-01-29",
          recurring: { startMonth: "2026-01" },
        }),
        tx({
          id: "far",
          date: "2026-01-15",
          recurring: { startMonth: "2026-01" },
        }),
        tx({
          id: "salary",
          type: "income",
          date: "2026-01-29",
          recurring: { startMonth: "2026-01" },
        }),
        tx({ id: "once", date: "2026-09-29" }),
      ],
      TODAY,
    );
    expect(bills.map((b) => [b.id, b.date, b.daysLeft])).toEqual([
      ["phone", "2026-09-29", 1],
      ["rent", "2026-10-01", 3],
    ]);
  });
});

describe("morningBrief", () => {
  it("gathers today's tasks and events, what slipped, and the month so far", () => {
    const brief = morningBrief(
      {
        tasks: [
          task({ id: "later", dueDate: TODAY }),
          task({ id: "early", dueDate: TODAY, dueTime: "08:00" }),
          task({ id: "old", dueDate: "2026-09-20" }),
          task({ id: "done", dueDate: TODAY, archivedAt: "x" }),
        ],
        events: [
          event({
            id: "gym",
            date: "2026-09-21",
            startTime: "18:00",
            repeat: { kind: "weekly", days: [1] },
          }),
          event({ id: "other", date: "2026-09-29" }),
        ],
        transactions: [
          tx({ amount: 300, date: "2026-09-10" }),
          tx({ amount: 999, date: "2026-09-30" }),
          tx({ type: "income", amount: 1000, date: "2026-09-01" }),
        ],
      },
      TODAY,
    );
    expect(brief.tasks.map((t) => t.id)).toEqual(["early", "later"]);
    expect(brief.events.map((e) => e.seriesId ?? e.id)).toEqual(["gym"]);
    expect(brief.carriedOver.map((t) => t.id)).toEqual(["old"]);
    expect(brief.month).toEqual({ income: 1000, expense: 300, balance: 700 });
  });
});

describe("weekSummary", () => {
  it("counts from Sunday, and compares spending with the same days last week", () => {
    const summary = weekSummary(
      {
        tasks: [
          task({
            completed: true,
            completedAt: "2026-09-27T08:00:00.000Z",
            archivedAt: "x",
          }),
          task({
            completed: true,
            completedAt: "2026-09-26T08:00:00.000Z",
            archivedAt: "x",
          }),
          task({ dueDate: "2026-09-25" }),
        ],
        transactions: [
          tx({ amount: 200, date: "2026-09-27" }),
          tx({ amount: 50, date: "2026-09-28" }),
          tx({ amount: 70, date: "2026-09-21" }),
          tx({ amount: 999, date: "2026-09-22" }),
        ],
      },
      TODAY,
    );
    expect(summary).toEqual({
      from: "2026-09-27",
      done: 1,
      slipped: 1,
      expense: 250,
      lastWeekExpense: 70,
    });
  });
});

describe("dueReminders", () => {
  const now = new Date("2026-09-28T09:55:00");

  it("fires when the moment comes, once, and not long after the start", () => {
    const data = {
      tasks: [
        task({
          id: "call",
          title: "להתקשר",
          dueDate: TODAY,
          dueTime: "10:00",
          reminder: 10,
        }),
        task({ id: "later", dueDate: TODAY, dueTime: "12:00", reminder: 10 }),
        task({ id: "none", dueDate: TODAY, dueTime: "10:00" }),
        task({ id: "gone", dueDate: TODAY, dueTime: "08:00", reminder: 0 }),
      ],
      events: [],
    };
    const due = dueReminders(data, now, new Set());
    expect(due.map((r) => r.key)).toEqual([`task:call@${TODAY}`]);
    expect(due[0]).toMatchObject({
      title: "להתקשר",
      body: "10:00 · בעוד 10 דקות",
    });
    expect(dueReminders(data, now, new Set([`task:call@${TODAY}`]))).toEqual(
      [],
    );
  });

  it("covers each occurrence of a recurring event, and day-before reminders", () => {
    const due = dueReminders(
      {
        tasks: [],
        events: [
          event({
            id: "gym",
            date: "2026-09-21",
            startTime: "10:00",
            reminder: 30,
            repeat: { kind: "daily" },
          }),
          event({
            id: "flight",
            date: "2026-09-29",
            startTime: "09:00",
            reminder: 1440,
          }),
          event({ id: "allday", allDay: true, reminder: 0 }),
        ],
      },
      now,
      new Set(),
    );
    expect(due.map((r) => r.key)).toEqual([
      "event:flight@2026-09-29",
      `event:gym@${TODAY}@${TODAY}`,
    ]);
    expect(due[0].body).toBe("09:00 · מחר");
  });
});
