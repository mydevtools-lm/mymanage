import { describe, expect, it } from "vitest";
import { HOLIDAYS, HOLIDAYS_FROM, HOLIDAYS_TO } from "./holidays-data";
import { HOLIDAY_GROUPS, holidaysBetween } from "./holidays";

const on = (day: string, locale: "en" | "he" = "en") =>
  holidaysBetween(day, day, locale).map((e) => e.title);

describe("holiday data", () => {
  it("is sorted, within the years it claims, with no repeated day and name", () => {
    const keys = HOLIDAYS.map((r) => `${r.d} ${r.en}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(HOLIDAYS.map((r) => r.d)).toEqual(
      [...HOLIDAYS.map((r) => r.d)].sort(),
    );
    for (const row of HOLIDAYS) {
      expect(row.d >= HOLIDAYS_FROM && row.d <= HOLIDAYS_TO, row.d).toBe(true);
      expect(row.en && row.he, row.d).toBeTruthy();
      expect(row.he, row.d).not.toMatch(/[֑-ׇ]/); // no niqqud
    }
  });

  it("covers 2026 to 2028, both groups, every year", () => {
    expect(HOLIDAYS_FROM).toBe("2026-01-01");
    expect(HOLIDAYS_TO).toBe("2028-12-31");
    for (const year of ["2026", "2027", "2028"]) {
      for (const group of ["jewish", "national"]) {
        expect(
          HOLIDAYS.some((r) => r.g === group && r.d.startsWith(year)),
          `${year} ${group}`,
        ).toBe(true);
      }
    }
  });

  it("leaves out what isn't a holiday here: Rosh Chodesh, Shabbatot, minor days", () => {
    const names = new Set(HOLIDAYS.map((r) => r.en));
    for (const out of [
      "Rosh Chodesh",
      "Leil Selichot",
      "Pesach Sheni",
      "Purim Katan",
      "Family Day",
      "Hebrew Language Day",
    ]) {
      expect(
        [...names].some((n) => n.startsWith(out)),
        out,
      ).toBe(false);
    }
  });
});

describe("known dates", () => {
  // Checked by hand against the Hebrew calendar, not against the library.
  it.each([
    ["2026-09-12", "Rosh Hashana 5787"],
    ["2026-09-13", "Rosh Hashana II"],
    ["2026-09-21", "Yom Kippur"],
    ["2026-09-26", "Sukkot I"],
    ["2026-10-03", "Shmini Atzeret"],
    ["2026-12-04", "Chanukah: 1 Candle"],
    ["2027-04-22", "Pesach I"],
    ["2027-04-28", "Pesach VII"],
    ["2027-05-12", "Yom HaAtzma’ut"],
    ["2027-06-11", "Shavuot"],
    ["2027-08-12", "Tish’a B’Av"],
    ["2028-04-11", "Pesach I"],
  ])("%s is %s", (day, title) => {
    expect(on(day)).toContain(title);
  });

  it("keeps Israel's one day of Shmini Atzeret and Simchat Torah", () => {
    expect(on("2026-10-04")).toEqual([]);
  });
});

describe("holidaysBetween", () => {
  it("returns read-only all-day events, inclusive of both ends", () => {
    const events = holidaysBetween("2026-09-12", "2026-09-14");
    expect(events.map((e) => e.date)).toEqual([
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
    ]);
    for (const e of events) {
      expect(e).toMatchObject({ allDay: true, source: "holidays" });
    }
  });

  it("speaks the interface language", () => {
    expect(on("2027-05-12", "he")).toEqual(["יום העצמאות"]);
    expect(on("2027-05-11", "he")).toEqual(["יום הזיכרון"]);
  });

  it("puts holidays and memorial days in their own calendars, with unique ids", () => {
    const events = holidaysBetween("2027-04-01", "2027-06-30", "en");
    const ids = HOLIDAY_GROUPS.map((g) => g.id);
    expect(new Set(events.map((e) => e.calendarId))).toEqual(new Set(ids));
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    const shoah = events.find((e) => e.title === "Yom HaShoah");
    expect(shoah?.calendarId).toBe("holidays-national");
  });

  it("is empty outside the years it has", () => {
    expect(holidaysBetween("2025-01-01", "2025-12-31")).toEqual([]);
    expect(holidaysBetween("2029-01-01", "2029-12-31")).toEqual([]);
  });
});
