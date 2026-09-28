import { describe, expect, it } from "vitest";
import { parseHebrew } from "./nl-parse";

// A Sunday.
const TODAY = "2026-09-27";
const parse = (text: string) => parseHebrew(text, TODAY);

describe("parseHebrew", () => {
  it("the sentence this was built for: two events on Monday", () => {
    expect(
      parse("ביום שני אני הולך לחממה ואחרי זה לארוחת צהריים משפחתית"),
    ).toEqual([
      { kind: "event", title: "חממה", date: "2026-09-28" },
      { kind: "event", title: "ארוחת צהריים משפחתית", date: "2026-09-28" },
    ]);
  });

  it("a to-do without a day is an undated task", () => {
    expect(parse("להחליף סיסמה בבנק מרכנתיל")).toEqual([
      { kind: "task", title: "להחליף סיסמה בבנק מרכנתיל" },
    ]);
  });

  it("a to-do with a day stays a task, due that day", () => {
    expect(parse("לקנות חלב מחר")).toEqual([
      { kind: "task", title: "לקנות חלב", date: "2026-09-28" },
    ]);
    expect(parse("בעוד 3 ימים להתקשר לסבתא")).toEqual([
      { kind: "task", title: "להתקשר לסבתא", date: "2026-09-30" },
    ]);
  });

  it("reads times and ranges", () => {
    expect(parse("מחר בשעה 10 פגישה עם רואה חשבון")).toEqual([
      {
        kind: "event",
        title: "פגישה עם רואה חשבון",
        date: "2026-09-28",
        time: "10:00",
      },
    ]);
    expect(parse("רופא שיניים 3.10 מ-9 עד 10:30")).toEqual([
      {
        kind: "event",
        title: "רופא שיניים",
        date: "2026-10-03",
        time: "09:00",
        endTime: "10:30",
      },
    ]);
  });

  it("an amount makes a transaction, dated today unless said", () => {
    expect(parse("סופר 250 ש״ח")).toEqual([
      {
        kind: "transaction",
        title: "סופר",
        date: TODAY,
        amount: 250,
        type: "expense",
      },
    ]);
    expect(parse("קיבלתי החזר ₪1,200 מחר")).toEqual([
      {
        kind: "transaction",
        title: "החזר",
        date: "2026-09-28",
        amount: 1200,
        type: "income",
      },
    ]);
  });

  it("said on that weekday, the weekday means next week", () => {
    expect(parse("ביום ראשון חוג")[0].date).toBe("2026-10-04");
    expect(parse("היום חוג")[0].date).toBe(TODAY);
  });

  it("a date already past this year means next year", () => {
    expect(parse("יום הולדת לאמא 5/3")[0].date).toBe("2027-03-05");
  });
});
