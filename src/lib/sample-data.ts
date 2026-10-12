import { addDays, format, parseISO } from "date-fns";
import type { CalendarEvent, Category, Note, Task, Transaction } from "./types";

/**
 * What a first run can start with instead of an empty screen (DESKTOP.md
 * 6.1). Every id starts with SAMPLE_PREFIX, so the whole set is recognised
 * and removed in one step, and nothing the person added is touched.
 */

export const SAMPLE_PREFIX = "sample-";

export const isSample = (id: string) => id.startsWith(SAMPLE_PREFIX);

export interface SampleData {
  tasks: Partial<Task>[];
  events: Partial<CalendarEvent>[];
  transactions: Partial<Transaction>[];
  notes: Partial<Note>[];
}

/** A few days of an ordinary week around `today` (yyyy-MM-dd). */
export function sampleData(today: string, categories: Category[]): SampleData {
  const day = (n: number) => format(addDays(parseISO(today), n), "yyyy-MM-dd");
  // By name among the default categories; renamed or deleted ones leave
  // the row without a category, as a new row would be.
  const category = (name: string) =>
    categories.find((c) => c.kind === "finance" && c.name === name)?.id;
  const id = (name: string) => `${SAMPLE_PREFIX}${name}`;

  return {
    tasks: [
      { id: id("task-1"), title: "לשלם חשבון חשמל", dueDate: today, priority: "high" },
      { id: id("task-2"), title: "לקנות מתנה ליום הולדת", dueDate: day(2), priority: "normal" },
      { id: id("task-3"), title: "להתקשר לאינסטלטור", priority: "low" },
    ],
    events: [
      {
        id: id("event-1"),
        title: "ארוחת צהריים עם דנה",
        date: today,
        startTime: "13:00",
        endTime: "14:00",
        allDay: false,
        color: "amber",
      },
      {
        id: id("event-2"),
        title: "חוג יוגה",
        date: day(1),
        startTime: "18:30",
        endTime: "19:30",
        allDay: false,
        color: "teal",
      },
    ],
    transactions: [
      {
        id: id("transaction-1"),
        type: "income",
        amount: 12000,
        description: "משכורת",
        date: today,
        categoryId: category("משכורת"),
      },
      {
        id: id("transaction-2"),
        type: "expense",
        amount: 240,
        description: "סופר",
        date: today,
        categoryId: category("אוכל"),
      },
    ],
    notes: [
      {
        id: id("note-1"),
        title: "רעיונות לחופשה",
        body: "צפון בסתיו · לבדוק צימרים · להזמין עד סוף החודש",
      },
    ],
  };
}
