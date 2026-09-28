import { describe, expect, it } from "vitest";
import {
  describeRepeat,
  nextOccurrence,
  occursOn,
  repeatFallsOn,
} from "./routines";

// 2026-09-27 is a Sunday.
describe("repeatFallsOn", () => {
  it("daily falls on every day", () => {
    expect(repeatFallsOn({ kind: "daily" }, "2026-09-27")).toBe(true);
    expect(repeatFallsOn({ kind: "daily" }, "2026-10-03")).toBe(true);
  });

  it("weekly falls on the chosen weekdays only", () => {
    const monWed = { kind: "weekly" as const, days: [1, 3] };
    expect(repeatFallsOn(monWed, "2026-09-27")).toBe(false); // Sun
    expect(repeatFallsOn(monWed, "2026-09-28")).toBe(true); // Mon
    expect(repeatFallsOn(monWed, "2026-09-30")).toBe(true); // Wed
    expect(repeatFallsOn(monWed, "2026-10-03")).toBe(false); // Sat
  });

  it("monthly on the 31st lands on the last day of shorter months", () => {
    const end = { kind: "monthly" as const, day: 31 };
    expect(repeatFallsOn(end, "2026-09-30")).toBe(true);
    expect(repeatFallsOn(end, "2026-09-29")).toBe(false);
    expect(repeatFallsOn(end, "2026-10-31")).toBe(true);
    expect(repeatFallsOn(end, "2026-10-30")).toBe(false);
    expect(repeatFallsOn(end, "2027-02-28")).toBe(true);
  });
});

describe("occursOn", () => {
  const routine = {
    repeat: { kind: "daily" as const },
    startDate: "2026-09-28",
  };

  it("does not fall before its start date", () => {
    expect(occursOn(routine, "2026-09-27")).toBe(false);
    expect(occursOn(routine, "2026-09-28")).toBe(true);
  });

  it("never falls while paused", () => {
    expect(occursOn({ ...routine, paused: true }, "2026-09-29")).toBe(false);
  });
});

describe("nextOccurrence", () => {
  it("finds the next chosen weekday", () => {
    const fridays = {
      repeat: { kind: "weekly" as const, days: [5] },
      startDate: "2026-01-01",
    };
    expect(nextOccurrence(fridays, "2026-09-28")).toBe("2026-10-02");
  });

  it("starts looking at the start date when that is later", () => {
    const daily = {
      repeat: { kind: "daily" as const },
      startDate: "2026-10-05",
    };
    expect(nextOccurrence(daily, "2026-09-28")).toBe("2026-10-05");
  });

  it("has none while paused", () => {
    expect(
      nextOccurrence(
        { repeat: { kind: "daily" }, startDate: "2026-01-01", paused: true },
        "2026-09-28",
      ),
    ).toBeUndefined();
  });
});

describe("describeRepeat", () => {
  it("says it in Hebrew", () => {
    expect(describeRepeat({ kind: "daily" })).toBe("כל יום");
    expect(describeRepeat({ kind: "weekly", days: [0, 1, 2, 3, 4] })).toBe(
      "ימים א׳–ה׳",
    );
    expect(describeRepeat({ kind: "weekly", days: [3, 1] })).toBe(
      "בימים ב׳, ד׳",
    );
    expect(describeRepeat({ kind: "weekly", days: [5] })).toBe("כל יום ו׳");
    expect(describeRepeat({ kind: "monthly", day: 10 })).toBe("ב־10 בכל חודש");
  });
});

describe("yearly", () => {
  it("falls on the start date's day and month", () => {
    const birthday = {
      repeat: { kind: "yearly" as const },
      startDate: "1990-10-03",
    };
    expect(occursOn(birthday, "2026-10-03")).toBe(true);
    expect(occursOn(birthday, "2026-10-04")).toBe(false);
    expect(occursOn(birthday, "2026-11-03")).toBe(false);
    expect(nextOccurrence(birthday, "2026-09-28")).toBe("2026-10-03");
  });

  it("29 February falls on the 28th in ordinary years", () => {
    const leap = {
      repeat: { kind: "yearly" as const },
      startDate: "2024-02-29",
    };
    expect(occursOn(leap, "2027-02-28")).toBe(true);
    expect(occursOn(leap, "2028-02-29")).toBe(true);
    expect(occursOn(leap, "2028-02-28")).toBe(false);
  });
});
