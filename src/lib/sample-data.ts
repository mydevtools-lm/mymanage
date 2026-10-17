import { addDays, format, parseISO } from "date-fns";
import type { CalendarEvent, Category, Note, Task, Transaction } from "./types";
import { getLocale, type Locale } from "./i18n";
import { DEFAULT_CATEGORY_SET } from "./schema";

/** The sample's words — data, written in the language chosen at the time. */
const WORDS = {
  en: {
    bill: "Pay the electricity bill",
    gift: "Buy a birthday present",
    plumber: "Call the plumber",
    lunch: "Lunch with Dana",
    yoga: "Yoga class",
    salary: "Salary",
    groceries: "Groceries",
    trip: "Holiday ideas",
    tripBody:
      "The north in autumn · look at cabins · book by the end of the month",
  },
  he: {
    bill: "לשלם חשבון חשמל",
    gift: "לקנות מתנה ליום הולדת",
    plumber: "להתקשר לאינסטלטור",
    lunch: "ארוחת צהריים עם דנה",
    yoga: "חוג יוגה",
    salary: "משכורת",
    groceries: "סופר",
    trip: "רעיונות לחופשה",
    tripBody: "צפון בסתיו · לבדוק צימרים · להזמין עד סוף החודש",
  },
};

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
export function sampleData(
  today: string,
  categories: Category[],
  locale: Locale = getLocale(),
): SampleData {
  const day = (n: number) => format(addDays(parseISO(today), n), "yyyy-MM-dd");
  const w = WORDS[locale];
  // A default category by its name in either language; renamed or deleted
  // ones leave the row without a category, as a new row would be.
  const category = (en: string) => {
    const names = DEFAULT_CATEGORY_SET.find((c) => c.en === en);
    return categories.find(
      (c) =>
        c.kind === "finance" && (c.name === names?.en || c.name === names?.he),
    )?.id;
  };
  const id = (name: string) => `${SAMPLE_PREFIX}${name}`;

  return {
    tasks: [
      { id: id("task-1"), title: w.bill, dueDate: today, priority: "high" },
      { id: id("task-2"), title: w.gift, dueDate: day(2), priority: "normal" },
      { id: id("task-3"), title: w.plumber, priority: "low" },
    ],
    events: [
      {
        id: id("event-1"),
        title: w.lunch,
        date: today,
        startTime: "13:00",
        endTime: "14:00",
        allDay: false,
        color: "amber",
      },
      {
        id: id("event-2"),
        title: w.yoga,
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
        description: w.salary,
        date: today,
        categoryId: category("Salary"),
      },
      {
        id: id("transaction-2"),
        type: "expense",
        amount: 240,
        description: w.groceries,
        date: today,
        categoryId: category("Food"),
      },
    ],
    notes: [
      {
        id: id("note-1"),
        title: w.trip,
        body: w.tripBody,
      },
    ],
  };
}
