import { describe, expect, it } from "vitest";
import { parseEnglish } from "./nl-parse-en";
import { parseSentence } from "./nl-parse";

const TODAY = "2026-09-28"; // a Monday

describe("parseEnglish", () => {
  it("reads an event with a day and a time", () => {
    expect(parseEnglish("lunch with Dana tomorrow at 1pm", TODAY)).toEqual([
      {
        kind: "event",
        title: "Lunch with Dana",
        date: "2026-09-29",
        time: "13:00",
        endTime: undefined,
        amount: undefined,
        type: undefined,
      },
    ]);
  });

  it("splits on 'then', and a day said once holds for what follows", () => {
    const items = parseEnglish(
      "on Wednesday gym at 7, then dinner with the kids",
      TODAY,
    );
    expect(items.map((i) => [i.kind, i.title, i.date, i.time])).toEqual([
      ["event", "Gym", "2026-09-30", "19:00"],
      ["event", "Dinner with the kids", "2026-09-30", undefined],
    ]);
  });

  it("keeps a plain 'and' inside a title, and spots tasks by their verb", () => {
    const [item] = parseEnglish("call mom and dad", TODAY);
    expect(item).toMatchObject({ kind: "task", title: "Call mom and dad" });
    expect(item.date).toBeUndefined();
  });

  it("reads money: expense by default, income by its words", () => {
    expect(parseEnglish("groceries $40", TODAY)[0]).toMatchObject({
      kind: "transaction",
      title: "Groceries",
      amount: 40,
      type: "expense",
      date: TODAY,
    });
    expect(
      parseEnglish("received salary 12,000 shekels", TODAY)[0],
    ).toMatchObject({
      kind: "transaction",
      amount: 12000,
      type: "income",
    });
  });

  it("reads time ranges and am/pm", () => {
    expect(parseEnglish("meeting from 10 to 11:30", TODAY)[0]).toMatchObject({
      time: "10:00",
      endTime: "11:30",
    });
    expect(parseEnglish("workshop 2-4pm", TODAY)[0]).toMatchObject({
      time: "14:00",
      endTime: "16:00",
    });
    expect(parseEnglish("breakfast at 8am", TODAY)[0]).toMatchObject({
      time: "08:00",
    });
  });

  it("reads month names and numeric dates, next year when already past", () => {
    expect(parseEnglish("dentist Oct 20", TODAY)[0].date).toBe("2026-10-20");
    expect(parseEnglish("party on the 3rd of January", TODAY)[0].date).toBe(
      "2027-01-03",
    );
    expect(parseEnglish("flight 20/10", TODAY)[0].date).toBe("2026-10-20");
    expect(parseEnglish("visit in 3 days", TODAY)[0].date).toBe("2026-10-01");
  });

  it("'on Monday' said on a Monday means next week", () => {
    expect(parseEnglish("class on Monday", TODAY)[0].date).toBe("2026-10-05");
  });
});

describe("parseSentence", () => {
  it("picks the reader by the sentence, not the interface", () => {
    expect(parseSentence("מחר חממה", TODAY)[0]).toMatchObject({
      title: "חממה",
      date: "2026-09-29",
    });
    expect(parseSentence("dinner tomorrow", TODAY)[0]).toMatchObject({
      title: "Dinner",
      date: "2026-09-29",
    });
  });
});
